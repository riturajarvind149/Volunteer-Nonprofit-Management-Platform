const express = require('express');
const signupController = require('../controllers/signupController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { validateSignupId } = require('../middleware/validateSignup');

const router = express.Router();

/**
 * @route   GET /api/signups/my
 * @desc    Get all signups of the authenticated volunteer
 * @access  Protected (VOLUNTEER only)
 */
router.get(
  '/my',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  signupController.getMySignups
);

/**
 * @route   GET /api/signups/:id
 * @desc    Get a single signup by ID (owner only)
 * @access  Protected (Any authenticated user, scoped by ownership)
 */
router.get(
  '/:id',
  authenticate,
  validateSignupId,
  signupController.getSignupById
);

module.exports = router;
