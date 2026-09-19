const express = require('express');
const opportunityController = require('../controllers/opportunityController');
const signupController = require('../controllers/signupController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const {
  validateCreateOpportunity,
  validateOpportunityId,
} = require('../middleware/validateOpportunity');
const {
  validateSignupOpportunityId,
} = require('../middleware/validateSignup');

const router = express.Router();

/**
 * @route   POST /api/opportunities
 * @desc    Create a new volunteer opportunity (Coordinator only, must own organization)
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
 * @desc    Get all volunteer opportunities
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
 * @desc    Get a single volunteer opportunity by UUID
 * @access  Protected (Any authenticated user)
 */
router.get(
  '/:id',
  authenticate,
  validateOpportunityId,
  opportunityController.getById
);

/**
 * @route   POST /api/opportunities/:opportunityId/signup
 * @desc    Sign up for an opportunity (Volunteer only)
 * @access  Protected (VOLUNTEER)
 */
router.post(
  '/:opportunityId/signup',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  validateSignupOpportunityId,
  signupController.createSignup
);

module.exports = router;
