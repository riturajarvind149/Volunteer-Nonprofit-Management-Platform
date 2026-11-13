const signupService = require('../services/signupService');

/**
 * Controller for volunteer signup endpoints.
 */

/**
 * Sign up for an opportunity
 * POST /api/opportunities/:opportunityId/signup
 */
const createSignup = async (req, res, next) => {
  try {
    const { opportunityId } = req.params;
    const volunteerId = req.user.id;

    const signup = await signupService.createSignup(opportunityId, volunteerId);

    res.status(201).json({
      status: 'success',
      message: 'Signed up for opportunity successfully',
      data: {
        signup,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve all signups for the authenticated volunteer
 * GET /api/signups/my
 */
const getMySignups = async (req, res, next) => {
  try {
    const volunteerId = req.user.id;
    const signups = await signupService.getMySignups(volunteerId);

    res.status(200).json({
      status: 'success',
      message: 'Volunteer signups retrieved successfully',
      data: {
        signups,
        opportunities: signups,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single signup by ID
 * GET /api/signups/:id
 */
const getSignupById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const signup = await signupService.getSignupById(id, user);

    res.status(200).json({
      status: 'success',
      message: 'Signup retrieved successfully',
      data: {
        signup,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a volunteer signup
 * PATCH /api/signups/:id/cancel
 */
const cancelSignup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const volunteerId = req.user.id;

    const signup = await signupService.cancelSignup(id, volunteerId);

    res.status(200).json({
      status: 'success',
      message: 'Signup cancelled successfully',
      data: {
        signup,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve attendees for an opportunity (Coordinator owner only)
 * GET /api/opportunities/:id/signups
 */
const getOpportunityAttendees = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coordinatorId = req.user.id;

    const result = await signupService.getOpportunityAttendees(id, coordinatorId);

    res.status(200).json({
      status: 'success',
      message: 'Opportunity attendees retrieved successfully',
      data: {
        opportunity: {
          id: result.opportunity.id,
          title: result.opportunity.title,
          event_date: result.opportunity.event_date,
          start_time: result.opportunity.start_time,
          end_time: result.opportunity.end_time,
          capacity: result.opportunity.capacity,
          status: result.opportunity.status,
          check_in_code: result.opportunity.check_in_code,
        },
        signups: result.attendees,
        attendees: result.attendees,
        waitlist: result.waitlist,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a volunteer signup status
 * PATCH /api/signups/:id/status
 */
const updateSignupStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const coordinatorId = req.user.id;

    const signup = await signupService.updateSignupStatus(
      id,
      status,
      coordinatorId
    );

    res.status(200).json({
      status: 'success',
      message: 'Signup status updated successfully',
      data: {
        signup,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a volunteer signup by opportunity ID
 * DELETE /api/opportunities/:opportunityId/signup
 */
const cancelSignupByOpportunity = async (req, res, next) => {
  try {
    const { opportunityId } = req.params;
    const volunteerId = req.user.id;

    const signup = await signupService.cancelSignupByOpportunity(
      opportunityId,
      volunteerId
    );

    res.status(200).json({
      status: 'success',
      message: 'Signup cancelled successfully',
      data: {
        signup,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/opportunities/:id/check-in  { code }
 */
const checkIn = async (req, res, next) => {
  try {
    const result = await signupService.checkIn(req.params.id, req.user.id, req.body?.code);
    res.status(200).json({
      status: 'success',
      message: result.already ? 'You are already checked in' : 'Checked in successfully. Thank you for volunteering!',
      data: { signup: result },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/signups/:id/attendance  { attendance_status }
 */
const setAttendance = async (req, res, next) => {
  try {
    const signup = await signupService.setAttendance(req.params.id, req.body?.attendance_status ?? null, req.user.id);
    res.status(200).json({ status: 'success', message: 'Attendance updated', data: { signup } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/signups/my/waitlist
 */
const getMyWaitlist = async (req, res, next) => {
  try {
    const waitlist = await require('../services/waitlistService').getMyWaitlist(req.user.id);
    res.status(200).json({ status: 'success', data: { waitlist } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/opportunities/:id/waitlist
 */
const joinWaitlist = async (req, res, next) => {
  try {
    const entry = await require('../services/waitlistService').joinWaitlist(req.params.id, req.user.id);
    res.status(201).json({
      status: 'success',
      message: `You're #${entry.position} on the waitlist. We'll email you if a spot opens up.`,
      data: { waitlist_entry: entry },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/opportunities/:id/waitlist
 */
const leaveWaitlist = async (req, res, next) => {
  try {
    await require('../services/waitlistService').leaveWaitlist(req.params.id, req.user.id);
    res.status(200).json({ status: 'success', message: 'Removed from the waitlist' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkIn,
  setAttendance,
  getMyWaitlist,
  joinWaitlist,
  leaveWaitlist,
  createSignup,
  getMySignups,
  getSignupById,
  cancelSignup,
  cancelSignupByOpportunity,
  getOpportunityAttendees,
  updateSignupStatus,
};
