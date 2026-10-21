const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');

const router = express.Router();

/**
 * @route   GET /api/analytics/volunteer
 * @desc    Get comprehensive volunteer analytics, streak, and activity
 * @access  Protected (VOLUNTEER)
 */
router.get(
  '/volunteer',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  analyticsController.getVolunteerAnalytics
);

/**
 * @route   GET /api/analytics/coordinator
 * @desc    Get comprehensive coordinator analytics, charts, and event metrics
 * @access  Protected (COORDINATOR)
 */
router.get(
  '/coordinator',
  authenticate,
  authorizeRoles('COORDINATOR'),
  analyticsController.getCoordinatorAnalytics
);

module.exports = router;
