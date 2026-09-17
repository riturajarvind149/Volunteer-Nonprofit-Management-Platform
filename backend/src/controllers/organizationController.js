const organizationService = require('../services/organizationService');

/**
 * Controller for organization endpoints
 */

/**
 * Create a new organization
 * POST /api/organizations
 */
const create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    // Always use authenticated coordinator ID from req.user
    const coordinator_id = req.user.id;

    const organization = await organizationService.createOrganization({
      name,
      description,
      coordinator_id,
    });

    res.status(201).json({
      status: 'success',
      message: 'Organization created successfully',
      data: {
        organization,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all organizations
 * GET /api/organizations
 */
const getAll = async (req, res, next) => {
  try {
    const organizations = await organizationService.getAllOrganizations();

    res.status(200).json({
      status: 'success',
      message: 'Organizations retrieved successfully',
      data: {
        organizations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single organization by ID
 * GET /api/organizations/:id
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const organization = await organizationService.getOrganizationById(id);

    res.status(200).json({
      status: 'success',
      message: 'Organization retrieved successfully',
      data: {
        organization,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
};
