const volunteerHoursRepository = require('../repositories/volunteerHoursRepository');
const signupRepository = require('../repositories/signupRepository');
const organizationRepository = require('../repositories/organizationRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const { isUuid } = require('../utils/validators');
const AppError = require('../utils/AppError');

/**
 * Service layer for volunteer hours management business logic.
 */

/**
 * Record volunteer hours for a signup (with optional idempotency support)
 * @param {Object} data
 * @param {string} data.signupId - Signup UUID
 * @param {number} data.hours - Number of hours
 * @param {string} [data.status] - Status (PENDING, RECORDED, VERIFIED)
 * @param {string|null} [data.idempotencyKey] - Optional Idempotency-Key
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Created or retrieved volunteer_hours record
 * @throws {AppError} 404 if signup not found
 * @throws {AppError} 400 if signup is cancelled
 * @throws {AppError} 403 if coordinator does not own the opportunity's organization
 * @throws {AppError} 409 if idempotency key payload mismatch
 */
const recordHours = async ({ signupId, hours, status, idempotencyKey = null }, coordinatorId) => {
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

  // 4. Delegate creation to repository (with transaction and concurrency safety)
  const volunteerHours = await volunteerHoursRepository.create({
    signup_id: signupId,
    hours,
    status: status || 'RECORDED',
    recorded_by: coordinatorId,
    idempotency_key: idempotencyKey,
  });

  // 5. Notify volunteer of hours submission
  try {
    if (signup && signup.volunteer_id) {
      await notificationService.createNotification({
        user_id: signup.volunteer_id,
        title: 'Hours Submitted',
        message: `${hours} hours submitted for ${signup.opportunity_title || 'event'}. Status: ${status || 'RECORDED'}`,
        type: 'HOURS',
        reference_id: volunteerHours.id,
      });
    }
  } catch (notifErr) {
    // Non-blocking notification
  }

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
  const updatedRecord = await volunteerHoursRepository.updateStatus(id, status);

  // 4. Notify volunteer when hours are verified
  try {
    if (['VERIFIED', 'REJECTED'].includes(status) && record.volunteer_id && record.status !== status) {
      const volunteer = await userRepository.findById(record.volunteer_id);
      await notificationService.notify({
        user: volunteer || { id: record.volunteer_id },
        title: status === 'VERIFIED' ? 'Hours Verified' : 'Hours Not Approved',
        message:
          status === 'VERIFIED'
            ? `Your ${record.hours} volunteer hours for ${record.opportunity_title || 'event'} have been verified!`
            : `Your ${record.hours} hours for ${record.opportunity_title || 'event'} were not approved. Contact the organizer for details.`,
        type: 'HOURS',
        reference_id: id,
        email: volunteer
          ? templates.hoursReviewed({ name: volunteer.full_name, hours: record.hours, title: record.opportunity_title, status })
          : undefined,
      });
    }
  } catch (notifErr) {
    // Non-blocking notification
  }

  return updatedRecord;
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

/**
 * Volunteer logs their own hours for a past event; a coordinator then verifies or rejects.
 */
const logOwnHours = async ({ signupId, hours, notes }, volunteerId) => {
  if (!isUuid(signupId)) {
    throw new AppError('Invalid signup ID format. Expected a valid UUID', 400);
  }
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > 24) {
    throw new AppError('Hours must be a number greater than 0 and at most 24', 400);
  }
  if (Math.round(hours * 100) !== hours * 100) {
    throw new AppError('Hours cannot have more than 2 decimal places', 400);
  }
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 1000)) {
    throw new AppError('Notes must be text of at most 1000 characters', 400);
  }

  const signup = await signupRepository.findById(signupId);
  if (!signup || signup.volunteer_id !== volunteerId) {
    throw new AppError('Signup not found', 404);
  }
  if (signup.status === 'CANCELLED') {
    throw new AppError('Cannot log hours for a cancelled signup', 400);
  }
  const eventPassed =
    signup.opportunity_status === 'COMPLETED' ||
    String(signup.opportunity_event_date).slice(0, 10) <=
      new Date().toLocaleDateString('en-CA', { timeZone: require('../config/env').config.timezone });
  if (!eventPassed) {
    throw new AppError('You can log hours once the event has taken place', 400);
  }

  const record = await volunteerHoursRepository.createSelfReported({
    signup_id: signupId,
    hours,
    notes: typeof notes === 'string' ? notes.trim() : null,
    volunteer_id: volunteerId,
  });

  try {
    await notificationService.createNotification({
      user_id: signup.coordinator_id,
      title: 'Hours awaiting review',
      message: `${signup.volunteer_name} logged ${hours} hours for ${signup.opportunity_title}.`,
      type: 'HOURS',
      reference_id: record.id,
    });
  } catch {
    // non-blocking
  }

  return record;
};

module.exports = {
  logOwnHours,
  recordHours,
  getMyHours,
  getOrganizationHours,
  updateStatus,
  getMyHoursSummary,
  getOrganizationHoursSummary,
  getOpportunityHoursSummary,
};





