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
    const { from_date, to_date } = req.query;
    const hours = await volunteerHoursService.getMyHours(volunteerId, {
      from_date,
      to_date,
    });

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

/**
 * Update status of a volunteer-hour record
 * PATCH /api/hours/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coordinatorId = req.user.id;
    const { status } = req.body;

    const updatedHours = await volunteerHoursService.updateStatus(
      id,
      status,
      coordinatorId
    );

    res.status(200).json({
      status: 'success',
      message: 'Volunteer hours status updated successfully',
      data: {
        volunteer_hours: updatedHours,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve volunteer hours aggregate summary for the authenticated volunteer
 * GET /api/hours/my/summary
 */
const getMyHoursSummary = async (req, res, next) => {
  try {
    const volunteerId = req.user.id;
    const summary = await volunteerHoursService.getMyHoursSummary(volunteerId);

    res.status(200).json({
      status: 'success',
      message: 'Volunteer hours summary retrieved successfully',
      data: {
        summary,
        ...summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve volunteer hours aggregate summary for organizations owned by authenticated coordinator
 * GET /api/hours/organization/summary
 */
const getOrganizationHoursSummary = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const summary = await volunteerHoursService.getOrganizationHoursSummary(coordinatorId);

    res.status(200).json({
      status: 'success',
      message: 'Organization volunteer hours summary retrieved successfully',
      data: {
        summary,
        ...summary,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve volunteer hours aggregate summary per opportunity for organizations owned by authenticated coordinator
 * GET /api/hours/organization/opportunities
 */
const getOrganizationOpportunitiesSummary = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const { from_date, to_date } = req.query;
    const opportunities = await volunteerHoursService.getOpportunityHoursSummary(coordinatorId, {
      from_date,
      to_date,
    });

    res.status(200).json({
      status: 'success',
      message: 'Opportunity volunteer hours summary retrieved successfully',
      data: {
        opportunities,
        opportunity_hours: opportunities,
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
  updateStatus,
  getMyHoursSummary,
  getOrganizationHoursSummary,
  getOrganizationOpportunitiesSummary,
};




