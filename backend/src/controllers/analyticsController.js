const analyticsService = require('../services/analyticsService');

/**
 * Controller for analytics and dashboard metrics.
 */

/**
 * Retrieve volunteer analytics
 * GET /api/analytics/volunteer
 */
const getVolunteerAnalytics = async (req, res, next) => {
  try {
    const volunteerId = req.user.id;
    const analytics = await analyticsService.getVolunteerAnalytics(volunteerId);

    res.status(200).json({
      status: 'success',
      message: 'Volunteer analytics retrieved successfully',
      data: {
        analytics,
        ...analytics,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve coordinator analytics
 * GET /api/analytics/coordinator
 */
const getCoordinatorAnalytics = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const { period } = req.query;
    const analytics = await analyticsService.getCoordinatorAnalytics(coordinatorId, { period });

    res.status(200).json({
      status: 'success',
      message: 'Coordinator analytics retrieved successfully',
      data: {
        analytics,
        ...analytics,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVolunteerAnalytics,
  getCoordinatorAnalytics,
};
