const opportunityRepository = require('../repositories/opportunityRepository');
const organizationRepository = require('../repositories/organizationRepository');
const signupRepository = require('../repositories/signupRepository');
const { normalizeTime } = require('../middleware/validateOpportunity');
const AppError = require('../utils/AppError');

/**
 * Service layer for opportunity business logic.
 */

/**
 * Creates a new opportunity ensuring coordinator ownership of the organization
 * @param {Object} opportunityData
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Created opportunity
 * @throws {AppError} 403 if coordinator does not own the organization
 */
const createOpportunity = async (opportunityData, coordinatorId) => {
  // 1. Verify that the authenticated coordinator owns the requested organization
  const organization = await organizationRepository.findByIdAndCoordinatorId(
    opportunityData.organization_id,
    coordinatorId
  );

  if (!organization) {
    throw new AppError(
      'You do not have permission to create an opportunity for this organization.',
      403
    );
  }

  // 2. Delegate creation to repository
  return await opportunityRepository.createOpportunity(opportunityData);
};

/**
 * Retrieves all opportunities
 * @returns {Promise<Array>} List of opportunities
 */
const getAllOpportunities = async () => {
  return await opportunityRepository.findAllOpportunities();
};

/**
 * Retrieves a single opportunity by UUID
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object>} Opportunity record
 * @throws {AppError} 404 if opportunity not found
 */
const getOpportunityById = async (id) => {
  const opportunity = await opportunityRepository.findOpportunityById(id);
  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }
  return opportunity;
};

/**
 * Partially updates an existing opportunity ensuring coordinator ownership and capacity constraints
 * @param {string} id - Opportunity UUID
 * @param {Object} updateData - Partial fields to update
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Updated opportunity record
 * @throws {AppError} 404 if opportunity not found
 * @throws {AppError} 403 if coordinator does not own the organization
 * @throws {AppError} 400 if resulting time range is invalid
 * @throws {AppError} 409 if new capacity is lower than current active signups
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

  // 3. Cross-validate start_time and end_time against existing values if one is updated
  const effectiveStartTime =
    updateData.start_time !== undefined ? updateData.start_time : opp.start_time;
  const effectiveEndTime =
    updateData.end_time !== undefined ? updateData.end_time : opp.end_time;

  if (normalizeTime(effectiveEndTime) < normalizeTime(effectiveStartTime)) {
    throw new AppError('End time must not be earlier than start time', 400);
  }

  // 4. Capacity safety: capacity cannot be reduced below active (non-cancelled) signup count
  if (updateData.capacity !== undefined) {
    const activeSignups = await signupRepository.countActiveSignupsByOpportunityId(id);
    if (updateData.capacity < activeSignups) {
      throw new AppError(
        `Cannot reduce capacity to ${updateData.capacity}. There are currently ${activeSignups} active signups.`,
        409
      );
    }
  }

  // 5. Delegate partial update to repository
  return await opportunityRepository.updateOpportunity(id, updateData);
};

module.exports = {
  createOpportunity,
  getAllOpportunities,
  getOpportunityById,
  updateOpportunity,
};
