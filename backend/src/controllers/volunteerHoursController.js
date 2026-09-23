const volunteerHoursService = require('../services/volunteerHoursService');

/**
 * Controller for volunteer hours management
 */

/**
 * Record volunteer hours for a signup
 * POST /api/signups/:signupId/hours
 */
const recordHours = async (req, res, next) => {
  try {
    const signupId = req.params.signupId || req.params.id;
    const coordinatorId = req.user.id;
    const { hours, status } = req.body;

    const volunteerHours = await volunteerHoursService.recordHours(
      { signupId, hours, status },
      coordinatorId
    );

    res.status(201).json({
      status: 'success',
      message: 'Volunteer hours recorded successfully',
      data: {
        volunteer_hours: volunteerHours,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordHours,
};
