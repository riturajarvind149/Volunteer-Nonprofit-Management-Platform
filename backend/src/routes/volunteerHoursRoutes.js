const express = require('express');
const volunteerHoursController = require('../controllers/volunteerHoursController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');

const router = express.Router();

/**
 * @route   GET /api/hours/my
 * @desc    Get all volunteer hours for the authenticated volunteer
 * @access  Protected (VOLUNTEER only)
 */
router.get(
  '/my',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  volunteerHoursController.getMyHours
);

/**
 * @route   GET /api/hours/organization
 * @desc    Get all volunteer hours for organizations owned by authenticated coordinator
 * @access  Protected (COORDINATOR only)
 */
router.get(
  '/organization',
  authenticate,
  authorizeRoles('COORDINATOR'),
  volunteerHoursController.getOrganizationHours
);

module.exports = router;
