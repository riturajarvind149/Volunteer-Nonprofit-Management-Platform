const pool = require('../config/db');
const userRepository = require('../repositories/userRepository');
const organizationRepository = require('../repositories/organizationRepository');
const opportunityRepository = require('../repositories/opportunityRepository');
const organizationMemberRepository = require('../repositories/organizationMemberRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const AppError = require('../utils/AppError');
const { paginationMeta } = require('../utils/validators');
const { missingVolunteerDetails } = require('../utils/volunteerDetails');

const ORG_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CLOSED'];

const audit = async (actorId, action, entityType, entityId, details) => {
  await pool.query(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
    [actorId, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
};

/** Platform-wide KPIs for the admin dashboard. */
const getStats = async () => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE role = 'VOLUNTEER') AS volunteers,
      (SELECT COUNT(*)::int FROM users WHERE role = 'COORDINATOR') AS coordinators,
      (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '30 days') AS new_users_30d,
      (SELECT COUNT(*)::int FROM organizations) AS organizations,
      (SELECT COUNT(*)::int FROM organizations WHERE verification_status = 'PENDING') AS pending_organizations,
      (SELECT COUNT(*)::int FROM opportunities WHERE status = 'PUBLISHED' AND event_date >= CURRENT_DATE) AS open_opportunities,
      (SELECT COUNT(*)::int FROM signups WHERE status = 'REGISTERED') AS active_signups,
      (SELECT COALESCE(SUM(hours), 0)::float FROM volunteer_hours WHERE status = 'VERIFIED') AS verified_hours
  `);
  return rows[0];
};

const listOrganizations = async ({ status, q, page, limit, offset }) => {
  if (status && !ORG_STATUSES.includes(status)) {
    throw new AppError(`status must be one of ${ORG_STATUSES.join(', ')}`, 400);
  }
  const { rows } = await pool.query(
    `SELECT org.id, org.name, org.description, org.email, org.phone, org.website, org.address,
            org.registration_type, org.registration_number, org.city,
            u.phone AS owner_phone,
            org.verification_status, org.verification_note, org.verified_at, org.closed_at, org.created_at,
            u.id AS owner_id, u.full_name AS owner_name, u.email AS owner_email,
            (SELECT COUNT(*)::int FROM opportunities o WHERE o.organization_id = org.id) AS opportunity_count,
            COUNT(*) OVER()::int AS total_count
       FROM organizations org
       -- Closed NGOs no longer have members, so the owner is optional here.
       LEFT JOIN organization_members owner ON owner.organization_id = org.id AND owner.role = 'OWNER'
       LEFT JOIN users u ON u.id = owner.user_id
      WHERE ($1::text IS NULL OR org.verification_status = $1)
        AND ($2::text IS NULL OR org.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
      ORDER BY (org.verification_status = 'PENDING') DESC, org.created_at DESC
      LIMIT $3 OFFSET $4`,
    [status || null, q || null, limit, offset]
  );
  const total = rows[0]?.total_count || 0;
  return {
    organizations: rows.map(({ total_count: _omit, ...r }) => r),
    pagination: paginationMeta({ page, limit }, total),
  };
};

const reviewOrganization = async (orgId, { status, note }, adminId) => {
  if (!['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(status)) {
    throw new AppError('status must be APPROVED, REJECTED, SUSPENDED or PENDING', 400);
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 1000)) {
    throw new AppError('note must be text of at most 1000 characters', 400);
  }
  if (['REJECTED', 'SUSPENDED'].includes(status) && (!note || !note.trim())) {
    throw new AppError('Please include a note explaining the decision', 400);
  }

  const existing = await organizationRepository.findById(orgId);
  if (!existing) throw new AppError('Organization not found', 404);
  if (existing.verification_status === 'CLOSED') {
    throw new AppError('This NGO is closed. Closed NGOs can’t be reviewed again.', 409, 'ORG_CLOSED');
  }

  const organization = await organizationRepository.setVerification(orgId, {
    status,
    note: note?.trim() || null,
    adminId,
  });
  await audit(adminId, `ORGANIZATION_${status}`, 'organization', orgId, { from: existing.verification_status, note });

  if (existing.verification_status !== status) {
    // The owner (NGO admin) hears about the review decision.
    const owner = (await organizationMemberRepository.findMembers(orgId)).find((m) => m.role === 'OWNER');
    if (owner) {
      await notificationService.notify({
        user: owner,
        title: status === 'APPROVED' ? 'Organization verified' : `Organization ${status.toLowerCase()}`,
        message:
          status === 'APPROVED'
            ? `${existing.name} is verified — you can now publish opportunities.`
            : `${existing.name} was marked ${status.toLowerCase()}.${note ? ` Note: ${note}` : ''}`,
        type: 'ORG_REVIEW',
        reference_id: orgId,
        email: templates.orgReviewed({ name: owner.full_name, orgName: existing.name, status, note }),
        force: true,
      });
    }
  }

  return organization;
};

/**
 * Close an NGO for good (admin). Upcoming events are cancelled and their volunteers
 * notified; the team is removed and told why. Past events and hours are kept.
 */
const closeOrganization = async (orgId, { reason }, adminId) => {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new AppError('Please include a reason for closing this NGO', 400);
  }
  if (reason.trim().length > 1000) {
    throw new AppError('reason must be at most 1000 characters', 400);
  }
  const note = reason.trim();

  const existing = await organizationRepository.findById(orgId);
  if (!existing) throw new AppError('Organization not found', 404);
  if (existing.verification_status === 'CLOSED') {
    throw new AppError('This NGO is already closed', 409, 'ORG_CLOSED');
  }

  const result = await organizationRepository.close(orgId, { reason: note, adminId });
  if (!result) throw new AppError('This NGO is already closed', 409, 'ORG_CLOSED');
  const { organization, members, cancelledOpportunityIds } = result;

  const owner = members.find((m) => m.role === 'OWNER');
  await audit(adminId, 'ORGANIZATION_CLOSED', 'organization', orgId, {
    from: existing.verification_status,
    note,
    owner_email: owner?.email,
    cancelled_events: cancelledOpportunityIds.length,
  });

  // Notifications must never undo the closure.
  try {
    for (const oppId of cancelledOpportunityIds) {
      const opp = await opportunityRepository.findOpportunityById(oppId);
      const volunteers = await opportunityRepository.findRegisteredVolunteers(oppId);
      for (const volunteer of volunteers) {
        await notificationService.notify({
          user: volunteer,
          title: 'Opportunity cancelled',
          message: `${opp.title} on ${opp.event_date} has been cancelled because ${existing.name} has closed.`,
          type: 'EVENT_CANCELLED',
          reference_id: oppId,
          email: templates.eventCancelled({ name: volunteer.full_name, opp, reason: opp.cancellation_reason }),
          force: true,
        });
      }
    }
    for (const member of members) {
      await notificationService.notify({
        user: member,
        title: 'NGO closed',
        message: `${existing.name} was closed by the ServeHub team. Reason: ${note}`,
        type: 'INFO',
        email: templates.orgClosed({ name: member.full_name, orgName: existing.name, reason: note }),
        force: true,
      });
    }
  } catch {
    // non-blocking
  }

  return { organization, cancelled_events: cancelledOpportunityIds.length };
};

const VOLUNTEER_STATUSES = ['UNVERIFIED', 'VERIFIED', 'FLAGGED'];

const listUsers = async ({ q, role, verification, page, limit }) => {
  if (role && !['VOLUNTEER', 'COORDINATOR', 'ADMIN'].includes(role)) {
    throw new AppError('Invalid role filter', 400);
  }
  if (verification && !VOLUNTEER_STATUSES.includes(verification)) {
    throw new AppError(`verification must be one of ${VOLUNTEER_STATUSES.join(', ')}`, 400);
  }
  const { users, total } = await userRepository.searchUsers({ q, role, verification, page, limit });
  return {
    users: users.map((u) => (u.role === 'VOLUNTEER' ? { ...u, missing_details: missingVolunteerDetails(u) } : u)),
    pagination: paginationMeta({ page, limit }, total),
  };
};

/** Admin marks a volunteer as a verified real person, flags them, or resets the review. */
const reviewVolunteer = async (userId, { status, note }, adminId) => {
  if (!VOLUNTEER_STATUSES.includes(status)) {
    throw new AppError(`status must be one of ${VOLUNTEER_STATUSES.join(', ')}`, 400);
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 1000)) {
    throw new AppError('note must be text of at most 1000 characters', 400);
  }
  if (status === 'FLAGGED' && (!note || !note.trim())) {
    throw new AppError('Please include a note explaining why this volunteer is flagged', 400);
  }

  const target = await userRepository.findById(userId);
  if (!target) throw new AppError('User not found', 404);
  if (target.role !== 'VOLUNTEER') throw new AppError('Only volunteer accounts can be verified here', 400);
  if (status === 'VERIFIED' && missingVolunteerDetails(target).length) {
    throw new AppError('This volunteer hasn’t completed their details yet, so they can’t be verified', 400);
  }

  const user = await userRepository.setVerification(userId, { status, note: note?.trim() || null, adminId });
  await audit(adminId, `VOLUNTEER_${status}`, 'user', userId, {
    email: target.email,
    from: target.verification_status,
    note: note?.trim() || undefined,
  });
  return { ...user, missing_details: missingVolunteerDetails(user) };
};

const setUserActive = async (userId, isActive, adminId) => {
  if (typeof isActive !== 'boolean') throw new AppError('is_active must be true or false', 400);
  if (userId === adminId) throw new AppError('You cannot change your own account status', 400);
  const target = await userRepository.findById(userId);
  if (!target) throw new AppError('User not found', 404);
  if (target.role === 'ADMIN') throw new AppError('Administrator accounts cannot be suspended here', 400);

  const user = await userRepository.setActive(userId, isActive);
  await audit(adminId, isActive ? 'USER_REACTIVATED' : 'USER_SUSPENDED', 'user', userId, { email: target.email });
  return user;
};

const listAuditLogs = async ({ page, limit, offset }) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
            u.full_name AS actor_name, u.email AS actor_email,
            COUNT(*) OVER()::int AS total_count
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const total = rows[0]?.total_count || 0;
  return { logs: rows.map(({ total_count: _omit, ...r }) => r), pagination: paginationMeta({ page, limit }, total) };
};

module.exports = {
  getStats,
  listOrganizations,
  reviewOrganization,
  closeOrganization,
  listUsers,
  reviewVolunteer,
  setUserActive,
  listAuditLogs,
};
