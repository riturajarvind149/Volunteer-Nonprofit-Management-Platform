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
    const userId = req.user.id;

    const signup = await signupService.getSignupById(id, userId);

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

module.exports = {
  createSignup,
  getMySignups,
  getSignupById,
  cancelSignup,
};
