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
 * Retrieves a single signup by ID ensuring volunteer ownership
 * @param {string} id - Signup UUID
 * @param {string} userId - Authenticated user UUID
 * @returns {Promise<Object>} Signup record with opportunity details
 * @throws {AppError} 404 if signup not found or belongs to another user
 */
const getSignupById = async (id, userId) => {
  const signup = await signupRepository.findById(id);

  // Return 404 if not found OR if not owned by the requesting volunteer (prevents data enumeration)
  if (!signup || signup.volunteer_id !== userId) {
    throw new AppError('Signup not found', 404);
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

module.exports = {
  createSignup,
  getMySignups,
  getSignupById,
  cancelSignup,
  getOpportunityAttendees,
};
