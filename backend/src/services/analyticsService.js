const analyticsRepository = require('../repositories/analyticsRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for dashboard and platform analytics.
 */

/**
 * Get volunteer analytics
 * @param {string} volunteerId - Volunteer UUID
 * @returns {Promise<Object>} Volunteer analytics metrics and trends
 */
const getVolunteerAnalytics = async (volunteerId) => {
  if (!volunteerId) {
    throw new AppError('Volunteer ID is required', 400);
  }
  return await analyticsRepository.getVolunteerAnalytics(volunteerId);
};

/**
 * Get coordinator analytics
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [options] - Options (e.g. period)
 * @returns {Promise<Object>} Coordinator analytics metrics and charts
 */
const getCoordinatorAnalytics = async (coordinatorId, options = {}) => {
  if (!coordinatorId) {
    throw new AppError('Coordinator ID is required', 400);
  }
  return await analyticsRepository.getCoordinatorAnalytics(coordinatorId, options);
};

module.exports = {
  getVolunteerAnalytics,
  getCoordinatorAnalytics,
};
