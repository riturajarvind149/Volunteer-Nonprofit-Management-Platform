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

module.exports = {
  recordHours,
};
