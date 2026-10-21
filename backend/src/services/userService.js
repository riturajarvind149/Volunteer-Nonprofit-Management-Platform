const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for user profile management.
 */

/**
 * Retrieve comprehensive user profile including impact metrics
 * @param {string} userId - User UUID
 * @param {string} role - 'VOLUNTEER' or 'COORDINATOR'
 * @returns {Promise<Object>} User profile and stats
 */
const getUserProfile = async (userId, role) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const stats = await userRepository.getUserStats(userId, role || user.role);

  return {
    ...user,
    stats,
  };
};

/**
 * Update authenticated user's profile details
 * @param {string} userId - User UUID
 * @param {Object} updateData - Key-value pairs to update
 * @returns {Promise<Object>} Updated user profile
 */
const updateUserProfile = async (userId, updateData) => {
  const existingUser = await userRepository.findById(userId);
  if (!existingUser) {
    throw new AppError('User not found', 404);
  }

  const allowedFields = ['full_name', 'phone', 'location', 'bio', 'skills', 'avatar_url'];
  const cleanFields = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      cleanFields[field] = updateData[field];
    }
  }

  // Validate skills if provided
  if (cleanFields.skills !== undefined && !Array.isArray(cleanFields.skills)) {
    throw new AppError('Skills must be an array of strings', 400);
  }

  const updatedUser = await userRepository.updateProfile(userId, cleanFields);
  const stats = await userRepository.getUserStats(userId, updatedUser.role);

  return {
    ...updatedUser,
    stats,
  };
};

module.exports = {
  getUserProfile,
  updateUserProfile,
};
