const userService = require('../services/userService');

/**
 * Controller for user profile management.
 */

/**
 * Get profile of authenticated user
 * GET /api/users/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getUserProfile(req.user.id, req.user.role);

    res.status(200).json({
      status: 'success',
      message: 'User profile retrieved successfully',
      data: {
        user: profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update profile of authenticated user
 * PATCH /api/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUserProfile(req.user.id, req.body);

    res.status(200).json({
      status: 'success',
      message: 'User profile updated successfully',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
