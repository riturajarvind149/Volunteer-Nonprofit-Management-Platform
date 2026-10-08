const express = require('express');
const opportunityController = require('../controllers/opportunityController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const {
  validateCreateOpportunity,
  validateOpportunityId,
} = require('../middleware/validateOpportunity');

const router = express.Router();

/**
 * @route   GET /api/opportunities/dashboard-stats
 * @desc    Get dashboard stats for authenticated user
 * @access  Protected (VOLUNTEER, COORDINATOR)
 * NOTE: must be defined before /:id to avoid "dashboard-stats" being parsed as a UUID
 */
router.get(
  '/dashboard-stats',
  authenticate,
  authorizeRoles('VOLUNTEER', 'COORDINATOR'),
  opportunityController.dashboardStats
);

/**
 * @route   GET /api/opportunities/my-signups
 * @desc    Get all opportunities the volunteer signed up for
 * @access  Protected (VOLUNTEER)
 */
router.get(
  '/my-signups',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  opportunityController.mySignups
);

/**
 * @route   POST /api/opportunities
 * @desc    Create a new opportunity
 * @access  Protected (COORDINATOR)
 */
router.post(
  '/',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateCreateOpportunity,
  opportunityController.create
);

/**
 * @route   GET /api/opportunities
 * @desc    List all published opportunities
 * @access  Protected (VOLUNTEER, COORDINATOR)
 */
router.get(
  '/',
  authenticate,
  authorizeRoles('VOLUNTEER', 'COORDINATOR'),
  opportunityController.getAll
);

/**
 * @route   GET /api/opportunities/:id
 * @desc    Get a single opportunity by UUID
 * @access  Protected (any authenticated user)
 */
router.get(
  '/:id',
  authenticate,
  validateOpportunityId,
  opportunityController.getById
);

/**
 * @route   POST /api/opportunities/:id/signup
 * @desc    Volunteer signs up for an opportunity
 * @access  Protected (VOLUNTEER)
 */
router.post(
  '/:id/signup',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  validateOpportunityId,
  opportunityController.signup
);

/**
 * @route   DELETE /api/opportunities/:id/signup
 * @desc    Volunteer cancels their signup
 * @access  Protected (VOLUNTEER)
 */
router.delete(
  '/:id/signup',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  validateOpportunityId,
  opportunityController.cancelSignup
);

module.exports = router;
