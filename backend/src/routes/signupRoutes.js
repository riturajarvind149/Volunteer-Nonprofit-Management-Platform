const express = require('express');
const signupController = require('../controllers/signupController');
const volunteerHoursController = require('../controllers/volunteerHoursController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { validateSignupId } = require('../middleware/validateSignup');
const { validateRecordHours } = require('../middleware/validateVolunteerHours');

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

/**
 * @route   PATCH /api/signups/:id/cancel
 * @desc    Cancel a volunteer signup (Owner only)
 * @access  Protected (VOLUNTEER only)
 */
router.patch(
  '/:id/cancel',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  validateSignupId,
  signupController.cancelSignup
);

/**
 * @route   POST /api/signups/:signupId/hours
 * @desc    Record volunteer hours for a signup (Coordinator owner only)
 * @access  Protected (COORDINATOR only)
 */
router.post(
  '/:signupId/hours',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateRecordHours,
  volunteerHoursController.recordHours
);

module.exports = router;
