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

module.exports = {
  createOrganization,
  getAllOrganizations,
  getOrganizationById,
};
