const opportunityRepository = require('../repositories/opportunityRepository');
const organizationRepository = require('../repositories/organizationRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for opportunity business logic.
 */

const createOpportunity = async (data, coordinatorId) => {
  // Verify the organization belongs to this coordinator
  const org = await organizationRepository.findById(data.organization_id);
  if (!org) {
    throw new AppError('Organization not found', 404);
  }
  if (org.coordinator_id !== coordinatorId) {
    throw new AppError('You are not authorized to post opportunities for this organization', 403);
  }

  return await opportunityRepository.create(data);
};

const getAllOpportunities = async () => {
  return await opportunityRepository.findAll();
};

const getOpportunityById = async (id) => {
  const opportunity = await opportunityRepository.findById(id);
  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }
  return opportunity;
};

const signUpForOpportunity = async ({ volunteerId, opportunityId }) => {
  const opportunity = await opportunityRepository.findById(opportunityId);
  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }

  // Check capacity
  if (Number(opportunity.spots_remaining) <= 0) {
    throw new AppError('This opportunity is fully booked', 409);
  }

  // Check duplicate signup
  const existing = await opportunityRepository.findSignup({
    volunteer_id: volunteerId,
    opportunity_id: opportunityId,
  });
  if (existing) {
    throw new AppError('You are already signed up for this opportunity', 409);
  }

  return await opportunityRepository.createSignup({
    volunteer_id: volunteerId,
    opportunity_id: opportunityId,
  });
};

const cancelSignUp = async ({ volunteerId, opportunityId }) => {
  const signup = await opportunityRepository.deleteSignup({
    volunteer_id: volunteerId,
    opportunity_id: opportunityId,
  });
  if (!signup) {
    throw new AppError('You are not registered for this opportunity', 404);
  }
  return signup;
};

const getMySignedUpOpportunities = async (volunteerId) => {
  return await opportunityRepository.findSignedUpByVolunteer(volunteerId);
};

const getDashboardStats = async (user) => {
  if (user.role === 'COORDINATOR') {
    return await opportunityRepository.getCoordinatorStats(user.id);
  }
  return await opportunityRepository.getVolunteerStats(user.id);
};

module.exports = {
  createOpportunity,
  getAllOpportunities,
  getOpportunityById,
  signUpForOpportunity,
  cancelSignUp,
  getMySignedUpOpportunities,
  getDashboardStats,
};
