const opportunityRepository = require('../repositories/opportunityRepository');
const organizationRepository = require('../repositories/organizationRepository');
const signupRepository = require('../repositories/signupRepository');
const waitlistRepository = require('../repositories/waitlistRepository');
const notificationService = require('./notificationService');
const waitlistService = require('./waitlistService');
const templates = require('./emailTemplates');
const { normalizeTime } = require('../middleware/validateOpportunity');
const { config } = require('../config/env');
const { paginationMeta } = require('../utils/validators');
const AppError = require('../utils/AppError');

/**
 * Service layer for opportunity business logic.
 */

const isOwner = (opp, user) => Boolean(user && opp.coordinator_id === user.id);
const canManage = (opp, user) => Boolean(user && (user.role === 'ADMIN' || isOwner(opp, user)));

/** Publicly visible = published/completed by a verified organization. */
const isPubliclyVisible = (opp) =>
  ['PUBLISHED', 'COMPLETED'].includes(opp.status) &&
  (opp.organization_verification_status === 'APPROVED' ||
    (!config.requireOrgApproval && !['REJECTED', 'SUSPENDED'].includes(opp.organization_verification_status)));

const stripPrivate = (opp, user) => {
  if (!opp) return opp;
  const copy = { ...opp };
  delete copy.reminder_sent_at;
  if (!canManage(opp, user)) delete copy.check_in_code;
  return copy;
};

const assertCanPublish = (organization) => {
  if (config.requireOrgApproval && organization.verification_status !== 'APPROVED') {
    throw new AppError(
      'Your organization must be verified by an administrator before you can publish opportunities. You can save it as a draft meanwhile.',
      403,
      'ORG_NOT_VERIFIED'
    );
  }
};

/**
 * Creates a new opportunity ensuring coordinator ownership of the organization
 */
const createOpportunity = async (opportunityData, coordinatorId) => {
  // 1. Verify that the authenticated coordinator owns the requested organization
  const organization = await organizationRepository.findByIdAndCoordinatorId(
    opportunityData.organization_id,
    coordinatorId
  );

  if (!organization) {
    throw new AppError('You do not have permission to create an opportunity for this organization.', 403);
  }

  // 2. Unverified organizations may only create drafts
  if (opportunityData.status === 'PUBLISHED') {
    assertCanPublish(organization);
  }

  // 3. Delegate creation to repository
  return await opportunityRepository.createOpportunity(opportunityData);
};

/**
 * Search / list opportunities visible to the caller.
 */
const searchOpportunities = async (user, params) => {
  const filters = {
    q: params.q,
    category: params.category,
    location: params.location,
    from_date: params.from_date,
    to_date: params.to_date,
    upcoming: params.upcoming,
    available: params.available,
    skills: params.skills,
    sort: params.sort,
    organization_id: params.organization_id,
    limit: params.limit,
    offset: params.offset,
  };

  if (user?.role === 'ADMIN') {
    filters.status = params.status;
  } else {
    filters.publicOnly = true;
    if (user?.role === 'COORDINATOR') filters.includeCoordinatorId = user.id;
    if (params.status && ['PUBLISHED', 'COMPLETED'].includes(params.status)) filters.status = params.status;
  }
  filters.requireApprovedOrg = config.requireOrgApproval;

  const { opportunities, total } = await opportunityRepository.searchOpportunities(filters);

  return {
    opportunities: opportunities.map((o) => stripPrivate(o, user)),
    pagination: paginationMeta({ page: params.page, limit: params.limit }, total),
  };
};

/**
 * Retrieves all opportunities (legacy helper)
 */
const getAllOpportunities = async () => {
  return await opportunityRepository.findAllOpportunities();
};

/**
 * Retrieves a single opportunity, enforcing visibility rules, and adds the
 * viewer's own registration / waitlist state.
 */
const getOpportunityById = async (id, user) => {
  const opportunity = await opportunityRepository.findOpportunityById(id);
  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }
  if (!isPubliclyVisible(opportunity) && !canManage(opportunity, user)) {
    throw new AppError('Opportunity not found', 404);
  }

  const result = stripPrivate(opportunity, user);

  if (user?.role === 'VOLUNTEER') {
    const signup = await signupRepository.findByVolunteerAndOpportunity(user.id, id);
    result.my_signup = signup
      ? {
          id: signup.id,
          status: signup.status,
          attendance_status: signup.attendance_status || null,
          checked_in_at: signup.checked_in_at || null,
        }
      : null;
    result.my_waitlist_position = await waitlistRepository.getPosition(id, user.id);
  }

  return result;
};

const notifyRegistered = async (opp, buildMessage) => {
  const volunteers = await opportunityRepository.findRegisteredVolunteers(opp.id);
  for (const volunteer of volunteers) {
    await notificationService.notify({ user: volunteer, ...buildMessage(volunteer) });
  }
  return volunteers.length;
};

/**
 * Partially updates an existing opportunity ensuring coordinator ownership and capacity constraints.
 * Side effects: notifies volunteers on cancellation / reschedule, and promotes the
 * waitlist when capacity grows.
 */
const updateOpportunity = async (id, updateData, coordinatorId) => {
  // 1. Verify opportunity exists and retrieve owning coordinator
  const opp = await opportunityRepository.findOpportunityByIdWithCoordinator(id);
  if (!opp) {
    throw new AppError('Opportunity not found', 404);
  }

  // 2. Verify coordinator owns the organization for this opportunity
  if (opp.coordinator_id !== coordinatorId) {
    throw new AppError('You do not have permission to update this opportunity', 403);
  }

  // 3. Publishing requires a verified organization
  if (updateData.status === 'PUBLISHED' && opp.status !== 'PUBLISHED') {
    const organization = await organizationRepository.findById(opp.organization_id);
    assertCanPublish(organization);
  }

  // 4. Cross-validate start_time and end_time against existing values if one is updated
  const effectiveStartTime = updateData.start_time !== undefined ? updateData.start_time : opp.start_time;
  const effectiveEndTime = updateData.end_time !== undefined ? updateData.end_time : opp.end_time;

  if (normalizeTime(effectiveEndTime) < normalizeTime(effectiveStartTime)) {
    throw new AppError('End time must not be earlier than start time', 400);
  }

  // 5. Capacity safety: capacity cannot be reduced below active (non-cancelled) signup count
  if (updateData.capacity !== undefined) {
    const activeSignups = await signupRepository.countActiveSignupsByOpportunityId(id);
    if (updateData.capacity < activeSignups) {
      throw new AppError(
        `Cannot reduce capacity to ${updateData.capacity}. There are currently ${activeSignups} active signups.`,
        409
      );
    }
  }

  // 6. Delegate partial update to repository
  const updated = await opportunityRepository.updateOpportunity(id, updateData);

  // 7. Side effects (non-blocking)
  try {
    const full = await opportunityRepository.findOpportunityById(id);
    const becameCancelled = updateData.status === 'CANCELLED' && opp.status !== 'CANCELLED';
    const rescheduled =
      !becameCancelled &&
      full.status === 'PUBLISHED' &&
      ['event_date', 'start_time', 'end_time', 'location'].some(
        (k) => updateData[k] !== undefined && String(updateData[k]) !== String(opp[k])
      );

    if (becameCancelled) {
      await notifyRegistered(full, (v) => ({
        title: 'Opportunity cancelled',
        message: `${full.title} on ${full.event_date} has been cancelled.`,
        type: 'EVENT_CANCELLED',
        reference_id: full.id,
        email: templates.eventCancelled({ name: v.full_name, opp: full, reason: full.cancellation_reason }),
        force: true,
      }));
    } else if (rescheduled) {
      await notifyRegistered(full, (v) => ({
        title: 'Opportunity updated',
        message: `The schedule or location of ${full.title} changed. Please review the new details.`,
        type: 'EVENT_UPDATED',
        reference_id: full.id,
        email: templates.eventUpdated({ name: v.full_name, opp: full }),
        force: true,
      }));
    }

    if (updateData.capacity !== undefined && updateData.capacity > opp.capacity) {
      await waitlistService.promoteAndNotify(id);
    }
    if (updateData.status === 'PUBLISHED' && opp.status !== 'PUBLISHED') {
      await waitlistService.promoteAndNotify(id);
    }
  } catch {
    // notifications must never fail the update
  }

  return updated;
};

/**
 * Retrieves dashboard statistics according to user role
 */
const getDashboardStats = async (user) => {
  if (user.role === 'COORDINATOR') {
    return await opportunityRepository.getCoordinatorStats(user.id);
  } else if (user.role === 'VOLUNTEER') {
    return await opportunityRepository.getVolunteerStats(user.id);
  } else {
    throw new AppError('Unauthorized role for dashboard statistics', 403);
  }
};

/**
 * Retrieves opportunities belonging to a specific coordinator's organizations
 */
const getManagedOpportunities = async (coordinatorId) => {
  return await opportunityRepository.findOpportunitiesByCoordinatorId(coordinatorId);
};

/**
 * Opportunity data needed for a calendar file (visibility enforced).
 */
const getForCalendar = async (id, user) => getOpportunityById(id, user);

module.exports = {
  createOpportunity,
  searchOpportunities,
  getAllOpportunities,
  getManagedOpportunities,
  getOpportunityById,
  updateOpportunity,
  getDashboardStats,
  getForCalendar,
  isPubliclyVisible,
  canManage,
};
