const express = require('express');
const volunteerHoursController = require('../controllers/volunteerHoursController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { validateUpdateHoursStatus } = require('../middleware/validateVolunteerHours');

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

/**
 * @route   PATCH /api/hours/:id/status
 * @desc    Update status of a volunteer-hour record (Coordinator only)
 * @access  Protected (COORDINATOR only)
 */
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateUpdateHoursStatus,
  volunteerHoursController.updateStatus
);

module.exports = router;

