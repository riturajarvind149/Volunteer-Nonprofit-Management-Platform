const pool = require('../config/db');
const userRepository = require('../repositories/userRepository');
const organizationRepository = require('../repositories/organizationRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const AppError = require('../utils/AppError');
const { paginationMeta } = require('../utils/validators');

const ORG_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

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
            org.verification_status, org.verification_note, org.verified_at, org.created_at,
            u.id AS coordinator_id, u.full_name AS coordinator_name, u.email AS coordinator_email,
            (SELECT COUNT(*)::int FROM opportunities o WHERE o.organization_id = org.id) AS opportunity_count,
            COUNT(*) OVER()::int AS total_count
       FROM organizations org
       JOIN users u ON u.id = org.coordinator_id
      WHERE ($1::text IS NULL OR org.verification_status = $1)
        AND ($2::text IS NULL OR org.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
      ORDER BY (org.verification_status = 'PENDING') DESC, org.created_at DESC
      LIMIT $3 OFFSET $4`,
    [status || null, q || null, limit, offset]
  );
  const total = rows[0]?.total_count || 0;
  return {
    organizations: rows.map(({ total_count, ...r }) => r),
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

  const organization = await organizationRepository.setVerification(orgId, {
    status,
    note: note?.trim() || null,
    adminId,
  });
  await audit(adminId, `ORGANIZATION_${status}`, 'organization', orgId, { from: existing.verification_status, note });

  if (existing.verification_status !== status) {
    const coordinator = await userRepository.findById(existing.coordinator_id);
    if (coordinator) {
      await notificationService.notify({
        user: coordinator,
        title: status === 'APPROVED' ? 'Organization verified' : `Organization ${status.toLowerCase()}`,
        message:
          status === 'APPROVED'
            ? `${existing.name} is verified — you can now publish opportunities.`
            : `${existing.name} was marked ${status.toLowerCase()}.${note ? ` Note: ${note}` : ''}`,
        type: 'ORG_REVIEW',
        reference_id: orgId,
        email: templates.orgReviewed({ name: coordinator.full_name, orgName: existing.name, status, note }),
        force: true,
      });
    }
  }

  return organization;
};

const listUsers = async ({ q, role, page, limit }) => {
  if (role && !['VOLUNTEER', 'COORDINATOR', 'ADMIN'].includes(role)) {
    throw new AppError('Invalid role filter', 400);
  }
  const { users, total } = await userRepository.searchUsers({ q, role, page, limit });
  return { users, pagination: paginationMeta({ page, limit }, total) };
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
  return { logs: rows.map(({ total_count, ...r }) => r), pagination: paginationMeta({ page, limit }, total) };
};

module.exports = {
  getStats,
  listOrganizations,
  reviewOrganization,
  listUsers,
  setUserActive,
  listAuditLogs,
};
