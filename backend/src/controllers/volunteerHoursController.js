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

/**
 * Retrieve all recorded volunteer hours for the authenticated volunteer
 * GET /api/hours/my
 */
const getMyHours = async (req, res, next) => {
  try {
    const volunteerId = req.user.id;
    const hours = await volunteerHoursService.getMyHours(volunteerId);

    res.status(200).json({
      status: 'success',
      message: 'Volunteer hours retrieved successfully',
      data: {
        volunteer_hours: hours,
        hours,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all volunteer hours for organizations owned by the authenticated coordinator
 * GET /api/hours/organization
 */
const getOrganizationHours = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const hours = await volunteerHoursService.getOrganizationHours(coordinatorId);

    res.status(200).json({
      status: 'success',
      message: 'Organization volunteer hours retrieved successfully',
      data: {
        volunteer_hours: hours,
        hours,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordHours,
  getMyHours,
  getOrganizationHours,
};

