const signupRepository = require('../repositories/signupRepository');
const opportunityRepository = require('../repositories/opportunityRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for volunteer signup business logic.
 */

/**
 * Creates a volunteer signup for a published opportunity with capacity check
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Object>} Created signup record
 */
const createSignup = async (opportunityId, volunteerId) => {
  return await signupRepository.createSignupTransaction(opportunityId, volunteerId);
};

/**
 * Retrieves all signups belonging to the authenticated volunteer
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Array>} List of signups with opportunity details
 */
const getMySignups = async (volunteerId) => {
  return await signupRepository.findByVolunteerId(volunteerId);
};

/**
 * Retrieves a single signup by ID ensuring role-based ownership:
 * - VOLUNTEER: Can only retrieve their own signup (returns 404 if not found or not owned, preventing ID enumeration).
 * - COORDINATOR: Can retrieve signups belonging to opportunities owned by their organization
 *                (returns 404 if signup does not exist, 403 if belonging to another coordinator's organization).
 * @param {string} id - Signup UUID
 * @param {Object|string} user - Authenticated user object { id, role } or userId string
 * @returns {Promise<Object>} Signup record with opportunity and organization details
 * @throws {AppError} 404 if signup not found or if volunteer does not own it
 * @throws {AppError} 403 if coordinator does not own the opportunity's organization
 */
const getSignupById = async (id, user) => {
  const userId = typeof user === 'object' ? user.id : user;
  const role = typeof user === 'object' ? user.role : 'VOLUNTEER';

  const signup = await signupRepository.findById(id);

  // If signup does not exist: return 404 according to existing convention
  if (!signup) {
    throw new AppError('Signup not found', 404);
  }

  // Role-specific ownership checks
  if (role === 'COORDINATOR') {
    if (signup.coordinator_id !== userId) {
      throw new AppError(
        'You do not have permission to view this signup',
        403
      );
    }
  } else {
    // Preserve strict 404 anti-enumeration behavior for volunteers
    if (signup.volunteer_id !== userId) {
      throw new AppError('Signup not found', 404);
    }
  }

  return signup;
};

/**
 * Cancels a volunteer signup ensuring ownership and active status
 * @param {string} signupId - Signup UUID
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Object>} Updated signup record
 * @throws {AppError} 404 if signup not found or belongs to another user
 * @throws {AppError} 400 if signup is already cancelled
 */
const cancelSignup = async (signupId, volunteerId) => {
  const signup = await signupRepository.findById(signupId);

  // Return 404 if not found OR if not owned by the requesting volunteer (prevents data enumeration)
  if (!signup || signup.volunteer_id !== volunteerId) {
    throw new AppError('Signup not found', 404);
  }

  // Validate that signup is not already CANCELLED
  if (signup.status === 'CANCELLED') {
    throw new AppError('Signup is already cancelled', 400);
  }

  return await signupRepository.updateStatus(signupId, 'CANCELLED');
};

/**
 * Retrieves attendee signups for an opportunity ensuring coordinator ownership of the organization
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Object containing opportunity and list of attendees
 * @throws {AppError} 404 if opportunity not found
 * @throws {AppError} 403 if coordinator does not own the organization
 */
const getOpportunityAttendees = async (opportunityId, coordinatorId) => {
  // 1. Verify opportunity exists
  const opportunity = await opportunityRepository.findOpportunityById(opportunityId);
  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }

  // 2. Verify coordinator owns the organization that created this opportunity
  const organization = await organizationRepository.findByIdAndCoordinatorId(
    opportunity.organization_id,
    coordinatorId
  );
  if (!organization) {
    throw new AppError(
      'You do not have permission to view attendees for this opportunity',
      403
    );
  }

  // 3. Fetch attendees joined with user, opportunity, and organization details
  const attendees = await signupRepository.findAttendeesByOpportunityId(opportunityId);

  return {
    opportunity,
    attendees,
  };
};

/**
 * Update the status of a volunteer signup (Coordinator only, ownership verified)
 * @param {string} id - Signup UUID
 * @param {string} status - New status (REGISTERED, CANCELLED)
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Updated signup record
 * @throws {AppError} 404 if signup not found
 * @throws {AppError} 403 if coordinator does not own the opportunity's organization
 * @throws {AppError} 400 if opportunity is not published when reactivating
 * @throws {AppError} 409 if opportunity capacity is reached when reactivating
 */
const updateSignupStatus = async (id, status, coordinatorId) => {
  // 1. Verify signup exists and retrieve ownership & opportunity metadata
  const signup = await signupRepository.findByIdWithCoordinator(id);
  if (!signup) {
    throw new AppError('Signup not found', 404);
  }

  // 2. Enforce ownership chain: coordinator owns the organization that created the opportunity
  if (signup.coordinator_id !== coordinatorId) {
    throw new AppError('You do not have permission to update this signup', 403);
  }

  // 3. Reactivation capacity protection: if moving from CANCELLED to REGISTERED
  if (status === 'REGISTERED' && signup.status !== 'REGISTERED') {
    if (signup.opportunity_status !== 'PUBLISHED') {
      throw new AppError(
        'Cannot register for an opportunity that is not published',
        400
      );
    }

    const currentCount = await signupRepository.countActiveSignupsByOpportunityId(
      signup.opportunity_id
    );
    if (currentCount >= signup.opportunity_capacity) {
      throw new AppError(
        'This opportunity has reached its maximum capacity',
        409
      );
    }
  }

  // 4. Update status in database
  return await signupRepository.updateStatus(id, status);
};

/**
 * Cancels a volunteer signup by opportunity ID and authenticated volunteer ID
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Object>} Updated signup record
 * @throws {AppError} 404 if signup not found for this volunteer and opportunity
 * @throws {AppError} 400 if signup is already cancelled
 */
const cancelSignupByOpportunity = async (opportunityId, volunteerId) => {
  const signup = await signupRepository.findByVolunteerAndOpportunity(
    volunteerId,
    opportunityId
  );

  // Return 404 if not found (prevents data enumeration and ensures volunteer owns signup)
  if (!signup) {
    throw new AppError('Signup not found', 404);
  }

  // Validate that signup is not already CANCELLED
  if (signup.status === 'CANCELLED') {
    throw new AppError('Signup is already cancelled', 400);
  }

  return await signupRepository.updateStatus(signup.id, 'CANCELLED');
};

module.exports = {
  createSignup,
  getMySignups,
  getSignupById,
  cancelSignup,
  cancelSignupByOpportunity,
  getOpportunityAttendees,
  updateSignupStatus,
};
