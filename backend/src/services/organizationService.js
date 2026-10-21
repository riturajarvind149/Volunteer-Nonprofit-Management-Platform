const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for organization business logic.
 */

/**
 * Creates a new organization associated with the authenticated coordinator
 * @param {Object} data
 * @param {string} data.name
 * @param {string|null} data.description
 * @param {string} data.coordinator_id
 * @returns {Promise<Object>} Created organization
 */
const createOrganization = async ({ name, description, coordinator_id }) => {
  return await organizationRepository.create({
    name,
    description,
    coordinator_id,
  });
};

/**
 * Retrieves all organizations
 * @returns {Promise<Array>} List of organizations
 */
const getAllOrganizations = async () => {
  return await organizationRepository.findAll();
};

/**
 * Retrieves a single organization by ID
 * @param {string} id - Organization UUID
 * @returns {Promise<Object>} Organization data
 * @throws {AppError} 404 if organization does not exist
 */
const getOrganizationById = async (id) => {
  const organization = await organizationRepository.findById(id);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }
  return organization;
};

/**
 * Update an existing organization (Coordinator ownership required)
 * @param {string} id - Organization UUID
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @param {Object} updateFields - Fields to update
 * @returns {Promise<Object>} Updated organization
 */
const updateOrganization = async (id, coordinatorId, updateFields) => {
  const organization = await organizationRepository.findById(id);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  if (organization.coordinator_id !== coordinatorId) {
    throw new AppError('You do not have permission to update this organization', 403);
  }

  return await organizationRepository.update(id, updateFields);
};

/**
 * Retrieve organization impact summary and analytics
 * @param {string} id - Organization UUID
 * @returns {Promise<Object>} Organization impact statistics
 */
const getOrganizationImpact = async (id) => {
  const organization = await organizationRepository.findById(id);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  const impact = await organizationRepository.getOrganizationImpactStats(id);
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      logo_url: organization.logo_url,
    },
    impact,
  };
};

module.exports = {
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  getOrganizationImpact,
};
