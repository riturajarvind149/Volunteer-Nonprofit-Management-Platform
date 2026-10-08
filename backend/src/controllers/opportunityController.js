const opportunityService = require('../services/opportunityService');

/**
 * POST /api/opportunities
 * Create a new opportunity (COORDINATOR only)
 */
const create = async (req, res, next) => {
  try {
    const opportunity = await opportunityService.createOpportunity(req.body, req.user.id);
    res.status(201).json({
      status: 'success',
      message: 'Opportunity created successfully',
      data: { opportunity },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/opportunities
 * List all published opportunities (authenticated)
 */
const getAll = async (req, res, next) => {
  try {
    const opportunities = await opportunityService.getAllOpportunities();
    res.status(200).json({
      status: 'success',
      message: 'Opportunities retrieved successfully',
      data: { opportunities },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/opportunities/:id
 * Get a single opportunity by UUID (authenticated)
 */
const getById = async (req, res, next) => {
  try {
    const opportunity = await opportunityService.getOpportunityById(req.params.id);
    res.status(200).json({
      status: 'success',
      message: 'Opportunity retrieved successfully',
      data: { opportunity },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/opportunities/:id/signup
 * Volunteer signs up for an opportunity (VOLUNTEER only)
 */
const signup = async (req, res, next) => {
  try {
    const result = await opportunityService.signUpForOpportunity({
      volunteerId: req.user.id,
      opportunityId: req.params.id,
    });
    res.status(201).json({
      status: 'success',
      message: 'Successfully signed up for the opportunity',
      data: { signup: result },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/opportunities/:id/signup
 * Volunteer cancels their signup (VOLUNTEER only)
 */
const cancelSignup = async (req, res, next) => {
  try {
    await opportunityService.cancelSignUp({
      volunteerId: req.user.id,
      opportunityId: req.params.id,
    });
    res.status(200).json({
      status: 'success',
      message: 'Signup cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/opportunities/my-signups
 * Get all opportunities the authenticated volunteer signed up for
 */
const mySignups = async (req, res, next) => {
  try {
    const opportunities = await opportunityService.getMySignedUpOpportunities(req.user.id);
    res.status(200).json({
      status: 'success',
      message: 'Your signed-up opportunities retrieved successfully',
      data: { opportunities },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/opportunities/dashboard-stats
 * Get dashboard stats for the authenticated user (volunteer or coordinator)
 */
const dashboardStats = async (req, res, next) => {
  try {
    const stats = await opportunityService.getDashboardStats(req.user);
    res.status(200).json({
      status: 'success',
      message: 'Dashboard stats retrieved successfully',
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  signup,
  cancelSignup,
  mySignups,
  dashboardStats,
};
