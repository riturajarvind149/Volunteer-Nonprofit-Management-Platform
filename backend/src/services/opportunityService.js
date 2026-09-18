const opportunityRepository = require('../repositories/opportunityRepository');
const organizationRepository = require('../repositories/organizationRepository');
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

module.exports = {
  createOpportunity,
  getAllOpportunities,
  getOpportunityById,
};
