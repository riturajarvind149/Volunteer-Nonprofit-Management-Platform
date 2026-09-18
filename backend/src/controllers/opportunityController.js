const opportunityService = require('../services/opportunityService');

/**
 * Controller for opportunity endpoints
 */

/**
 * Create a new opportunity
 * POST /api/opportunities
 */
const create = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const opportunity = await opportunityService.createOpportunity(req.body, coordinatorId);

    res.status(201).json({
      status: 'success',
      message: 'Opportunity created successfully',
      data: {
        opportunity,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all opportunities
 * GET /api/opportunities
 */
const getAll = async (req, res, next) => {
  try {
    const opportunities = await opportunityService.getAllOpportunities();

    res.status(200).json({
      status: 'success',
      message: 'Opportunities retrieved successfully',
      data: {
        opportunities,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single opportunity by ID
 * GET /api/opportunities/:id
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const opportunity = await opportunityService.getOpportunityById(id);

    res.status(200).json({
      status: 'success',
      message: 'Opportunity retrieved successfully',
      data: {
        opportunity,
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
