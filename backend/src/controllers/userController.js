const userService = require('../services/userService');

/**
 * GET /api/users/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getUserProfile(req.user.id, req.user.role);
    res.status(200).json({
      status: 'success',
      message: 'User profile retrieved successfully',
      data: { user: profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateUserProfile(req.user.id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'User profile updated successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/me/export
 */
const exportData = async (req, res, next) => {
  try {
    const data = await userService.exportUserData(req.user.id);
    res.setHeader('Content-Disposition', 'attachment; filename="my-servehub-data.json"');
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/me  { password }
 */
const deleteAccount = async (req, res, next) => {
  try {
    await userService.deleteAccount(req.user.id, req.body?.password);
    res.status(200).json({ status: 'success', message: 'Your account has been permanently deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  exportData,
  deleteAccount,
};
