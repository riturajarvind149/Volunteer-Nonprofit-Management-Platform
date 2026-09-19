const signupRepository = require('../repositories/signupRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for volunteer signup business logic.
 */

/**
 * Creates a volunteer signup for a published opportunity with capacity check
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Object>} Created signup record
 */
const createSignup = async (opportunityId, volunteerId) => {
  return await signupRepository.createSignupTransaction(opportunityId, volunteerId);
};

/**
 * Retrieves all signups belonging to the authenticated volunteer
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Array>} List of signups with opportunity details
 */
const getMySignups = async (volunteerId) => {
  return await signupRepository.findByVolunteerId(volunteerId);
};

/**
 * Retrieves a single signup by ID ensuring volunteer ownership
 * @param {string} id - Signup UUID
 * @param {string} userId - Authenticated user UUID
 * @returns {Promise<Object>} Signup record with opportunity details
 * @throws {AppError} 404 if signup not found or belongs to another user
 */
const getSignupById = async (id, userId) => {
  const signup = await signupRepository.findById(id);

  // Return 404 if not found OR if not owned by the requesting volunteer (prevents data enumeration)
  if (!signup || signup.volunteer_id !== userId) {
    throw new AppError('Signup not found', 404);
  }

  return signup;
};

module.exports = {
  createSignup,
  getMySignups,
  getSignupById,
};
