const express = require('express');
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { validateDateRangeFilter } = require('../middleware/validateVolunteerHours');

const router = express.Router();

/**
 * @route   GET /api/reports/volunteer-participation
 * @desc    Generate volunteer participation report (Coordinator only)
 * @access  Protected (COORDINATOR)
 */
router.get(
  '/volunteer-participation',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateDateRangeFilter,
  reportController.getVolunteerParticipationReport
);

/**
 * @route   GET /api/reports/volunteer-hours
 * @desc    Generate volunteer hours report (Coordinator only)
 * @access  Protected (COORDINATOR)
 */
router.get(
  '/volunteer-hours',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateDateRangeFilter,
  reportController.getVolunteerHoursReport
);

/**
 * @route   GET /api/reports/opportunity-performance
 * @desc    Generate opportunity performance report (Coordinator only)
 * @access  Protected (COORDINATOR)
 */
router.get(
  '/opportunity-performance',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateDateRangeFilter,
  reportController.getOpportunityPerformanceReport
);

module.exports = router;
