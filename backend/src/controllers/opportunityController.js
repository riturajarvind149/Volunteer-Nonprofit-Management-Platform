const opportunityService = require('../services/opportunityService');
const AppError = require('../utils/AppError');

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
 * Retrieve all opportunities (supports ?managed=true for coordinator's own opportunities)
 * GET /api/opportunities
 */
const getAll = async (req, res, next) => {
  try {
    const { managed } = req.query;
    let opportunities;

    if (managed === 'true') {
      if (!req.user || req.user.role !== 'COORDINATOR') {
        throw new AppError('Only coordinators can access managed opportunities', 403);
      }
      opportunities = await opportunityService.getManagedOpportunities(req.user.id);
    } else {
      opportunities = await opportunityService.getAllOpportunities();
    }

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

/**
 * Update an opportunity partially (Coordinator owner only)
 * PATCH /api/opportunities/:id
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coordinatorId = req.user.id;

    const opportunity = await opportunityService.updateOpportunity(
      id,
      req.body,
      coordinatorId
    );

    res.status(200).json({
      status: 'success',
      message: 'Opportunity updated successfully',
      data: {
        opportunity,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve dashboard statistics for authenticated user
 * GET /api/opportunities/dashboard-stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const user = req.user;
    const stats = await opportunityService.getDashboardStats(user);

    res.status(200).json({
      status: 'success',
      message: 'Dashboard statistics retrieved successfully',
      data: {
        stats,
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
  update,
  getDashboardStats,
};
