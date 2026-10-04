const volunteerHoursRepository = require('../repositories/volunteerHoursRepository');
const signupRepository = require('../repositories/signupRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for volunteer hours management business logic.
 */

/**
 * Record volunteer hours for a signup
 * @param {Object} data
 * @param {string} data.signupId - Signup UUID
 * @param {number} data.hours - Number of hours
 * @param {string} [data.status] - Status (PENDING, RECORDED, VERIFIED)
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Created volunteer_hours record
 * @throws {AppError} 404 if signup not found
 * @throws {AppError} 400 if signup is cancelled
 * @throws {AppError} 403 if coordinator does not own the opportunity's organization
 */
const recordHours = async ({ signupId, hours, status }, coordinatorId) => {
  // 1. Verify signup exists
  const signup = await signupRepository.findById(signupId);
  if (!signup) {
    throw new AppError('Signup not found', 404);
  }

  // 2. Verify signup state (Cannot record hours for cancelled signups)
  if (signup.status === 'CANCELLED') {
    throw new AppError('Cannot record hours for a cancelled signup', 400);
  }

  // 3. Verify coordinator ownership: Coordinator -> Organization -> Opportunity -> Signup
  const organization = await organizationRepository.findByIdAndCoordinatorId(
    signup.opportunity_organization_id,
    coordinatorId
  );
  if (!organization) {
    throw new AppError(
      'You do not have permission to record hours for this signup',
      403
    );
  }

  // 4. Delegate creation to repository
  const volunteerHours = await volunteerHoursRepository.create({
    signup_id: signupId,
    hours,
    status: status || 'RECORDED',
    recorded_by: coordinatorId,
  });

  return volunteerHours;
};

/**
 * Retrieve all volunteer hours for the authenticated volunteer
 * @param {string} volunteerId - Volunteer UUID
 * @param {Object} [filters] - Optional date filters { from_date, to_date }
 * @returns {Promise<Array>} List of volunteer hours with joined details
 */
const getMyHours = async (volunteerId, filters = {}) => {
  return await volunteerHoursRepository.findByVolunteerId(volunteerId, filters);
};

/**
 * Retrieve all volunteer hours for organizations owned by the authenticated coordinator
 * @param {string} coordinatorId - Coordinator UUID
 * @returns {Promise<Array>} List of organization volunteer hours with joined details
 */
const getOrganizationHours = async (coordinatorId) => {
  return await volunteerHoursRepository.findByCoordinatorId(coordinatorId);
};

/**
 * Update the status of a volunteer hours record (Coordinator only, ownership verified)
 * @param {string} id - Volunteer hours UUID
 * @param {string} status - New status (PENDING, RECORDED, VERIFIED)
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Updated volunteer_hours record
 * @throws {AppError} 404 if volunteer hours record does not exist
 * @throws {AppError} 403 if coordinator does not own the organization
 */
const updateStatus = async (id, status, coordinatorId) => {
  // 1. Verify volunteer hours record exists and get owning coordinator
  const record = await volunteerHoursRepository.findByIdWithCoordinator(id);
  if (!record) {
    throw new AppError('Volunteer hours record not found', 404);
  }

  // 2. Enforce ownership chain: coordinator owns the organization
  if (record.coordinator_id !== coordinatorId) {
    throw new AppError(
      'You do not have permission to update status for this volunteer hours record',
      403
    );
  }

  // 3. Delegate update to repository
  return await volunteerHoursRepository.updateStatus(id, status);
};

/**
 * Retrieve volunteer hours aggregate summary for the authenticated volunteer
 * @param {string} volunteerId - Volunteer UUID
 * @returns {Promise<Object>} Summary object
 */
const getMyHoursSummary = async (volunteerId) => {
  return await volunteerHoursRepository.getSummaryByVolunteerId(volunteerId);
};

/**
 * Retrieve volunteer hours aggregate summary for organizations owned by the authenticated coordinator
 * @param {string} coordinatorId - Coordinator UUID
 * @returns {Promise<Object>} Summary object
 */
const getOrganizationHoursSummary = async (coordinatorId) => {
  return await volunteerHoursRepository.getSummaryByCoordinatorId(coordinatorId);
};

/**
 * Retrieve volunteer hours aggregate summary per opportunity for organizations owned by the authenticated coordinator
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [filters] - Optional date filters { from_date, to_date }
 * @returns {Promise<Array>} List of opportunity summaries
 */
const getOpportunityHoursSummary = async (coordinatorId, filters = {}) => {
  return await volunteerHoursRepository.getOpportunitySummaryByCoordinatorId(coordinatorId, filters);
};

module.exports = {
  recordHours,
  getMyHours,
  getOrganizationHours,
  updateStatus,
  getMyHoursSummary,
  getOrganizationHoursSummary,
  getOpportunityHoursSummary,
};





