const signupRepository = require('../repositories/signupRepository');
const opportunityRepository = require('../repositories/opportunityRepository');
const organizationRepository = require('../repositories/organizationRepository');
const organizationMemberRepository = require('../repositories/organizationMemberRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const waitlistService = require('./waitlistService');
const templates = require('./emailTemplates');
const { icsAttachment } = require('../utils/ical');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');
const { assertVolunteerCanRegister } = require('../utils/volunteerDetails');

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
  // Volunteers must have completed their identity details (and not be flagged) before registering.
  assertVolunteerCanRegister(await userRepository.findById(volunteerId));

  const signup = await signupRepository.createSignupTransaction(opportunityId, volunteerId);

  // Non-blocking notification dispatch
  try {
    const opp = await opportunityRepository.findOpportunityById(opportunityId);
    const volunteer = await userRepository.findById(volunteerId);
    if (opp && volunteer) {
      await notificationService.notify({
        user: volunteer,
        title: 'Registration Confirmed',
        message: `You successfully registered for ${opp.title} on ${opp.event_date}`,
        type: 'REGISTRATION',
        reference_id: opp.id,
        email: templates.signupConfirmed({ name: volunteer.full_name, opp }),
        attachments: [icsAttachment(opp)],
      });

      // Everyone who manages the organization hears about new registrations.
      const managers = await organizationMemberRepository.findMembers(opp.organization_id);
      for (const manager of managers) {
        await notificationService.createNotification({
          user_id: manager.id,
          title: 'New Registration',
          message: `A volunteer registered for ${opp.title}`,
          type: 'REGISTRATION',
          reference_id: opp.id,
        });
      }
    }
  } catch {
    // Non-blocking
  }

  return signup;
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
 * Retrieves attendee signups for an opportunity; the coordinator must belong to its organization
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Object containing opportunity and list of attendees
 * @throws {AppError} 404 if opportunity not found
 * @throws {AppError} 403 if the coordinator is not a member of the organization
 */
const getOpportunityAttendees = async (opportunityId, coordinatorId) => {
  // 1. Verify opportunity exists
  const opportunity = await opportunityRepository.findOpportunityById(opportunityId);
  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }

  // 2. Verify the coordinator belongs to the organization that created this opportunity
  const organization = await organizationRepository.findManagedById(
    opportunity.organization_id,
    coordinatorId
  );
  if (!organization) {
    throw new AppError(
      'You do not have permission to view attendees for this opportunity',
      403
    );
  }

  // 3. Fetch attendees joined with user, opportunity, and organization details
  const attendees = await signupRepository.findAttendeesByOpportunityId(opportunityId);
  const waitlist = await require('../repositories/waitlistRepository').findByOpportunity(opportunityId);

  return {
    opportunity,
    attendees,
    waitlist,
  };
};

/**
 * Update the status of a volunteer signup (Coordinator only, ownership verified)
 * @param {string} id - Signup UUID
 * @param {string} status - New status (REGISTERED, CANCELLED)
 * @param {string} coordinatorId - Authenticated coordinator UUID
 * @returns {Promise<Object>} Updated signup record
 * @throws {AppError} 404 if signup not found
 * @throws {AppError} 403 if coordinator does not own the opportunity's organization
 * @throws {AppError} 400 if opportunity is not published when reactivating
 * @throws {AppError} 409 if opportunity capacity is reached when reactivating
 */
const updateSignupStatus = async (id, status, coordinatorId) => {
  // 1. Verify signup exists and retrieve ownership & opportunity metadata
  const signup = await signupRepository.findByIdWithOrganization(id);
  if (!signup) {
    throw new AppError('Signup not found', 404);
  }

  // 2. The coordinator must belong to the organization that created the opportunity
  if (!(await organizationMemberRepository.findRole(signup.organization_id, coordinatorId))) {
    throw new AppError('You do not have permission to update this signup', 403);
  }

  // 3. Reactivation capacity protection: if moving from CANCELLED to REGISTERED,
  // execute concurrency-safe reactivation transaction with opportunity row lock (FOR UPDATE)
  if (status === 'REGISTERED' && signup.status !== 'REGISTERED') {
    return await signupRepository.reactivateSignupTransaction(
      id,
      signup.opportunity_id
    );
  }

  // 4. Update status in database
  const updated = await signupRepository.updateStatus(id, status);
  if (status === 'CANCELLED' && signup.status !== 'CANCELLED') {
    await waitlistService.promoteAndNotify(signup.opportunity_id);
  }
  return updated;
};

/**
 * Cancels a volunteer signup by opportunity ID and authenticated volunteer ID
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} volunteerId - Authenticated volunteer UUID
 * @returns {Promise<Object>} Updated signup record
 * @throws {AppError} 404 if signup not found for this volunteer and opportunity
 * @throws {AppError} 400 if signup is already cancelled
 */
const cancelSignupByOpportunity = async (opportunityId, volunteerId) => {
  const signup = await signupRepository.findByVolunteerAndOpportunity(
    volunteerId,
    opportunityId
  );

  // Return 404 if not found (prevents data enumeration and ensures volunteer owns signup)
  if (!signup) {
    throw new AppError('Signup not found', 404);
  }

  // Validate that signup is not already CANCELLED
  if (signup.status === 'CANCELLED') {
    throw new AppError('Signup is already cancelled', 400);
  }

  const cancelled = await signupRepository.updateStatus(signup.id, 'CANCELLED');
  await waitlistService.promoteAndNotify(opportunityId);
  return cancelled;
};

/**
 * Volunteer self check-in using the code shown at the venue.
 */
const checkIn = async (opportunityId, volunteerId, code) => {
  return await signupRepository.checkIn(opportunityId, volunteerId, code, config.timezone);
};

/**
 * Coordinator marks a volunteer as present / absent.
 */
const setAttendance = async (signupId, attendanceStatus, coordinatorId) => {
  const allowed = ['PRESENT', 'ABSENT', null];
  const normalized = attendanceStatus === null || attendanceStatus === '' ? null : String(attendanceStatus).toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new AppError('attendance_status must be PRESENT, ABSENT or null', 400);
  }
  const signup = await signupRepository.findByIdWithOrganization(signupId);
  if (!signup) throw new AppError('Signup not found', 404);
  if (!(await organizationMemberRepository.findRole(signup.organization_id, coordinatorId))) {
    throw new AppError('You do not have permission to update this signup', 403);
  }
  if (signup.status === 'CANCELLED') {
    throw new AppError('Cannot mark attendance for a cancelled signup', 400);
  }
  return await signupRepository.setAttendance(signupId, normalized);
};

module.exports = {
  checkIn,
  setAttendance,
  createSignup,
  getMySignups,
  cancelSignupByOpportunity,
  getOpportunityAttendees,
  updateSignupStatus,
};
