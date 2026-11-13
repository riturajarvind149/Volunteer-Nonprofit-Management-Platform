const waitlistRepository = require('../repositories/waitlistRepository');
const opportunityRepository = require('../repositories/opportunityRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const { icsAttachment } = require('../utils/ical');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const joinWaitlist = async (opportunityId, volunteerId) => {
  const entry = await waitlistRepository.join(opportunityId, volunteerId);
  return entry;
};

const leaveWaitlist = async (opportunityId, volunteerId) => {
  const removed = await waitlistRepository.leave(opportunityId, volunteerId);
  if (!removed) throw new AppError('You are not on the waitlist for this opportunity', 404);
};

const getMyWaitlist = async (volunteerId) => waitlistRepository.findByVolunteer(volunteerId);

/**
 * Fill freed spots from the waitlist and notify promoted volunteers.
 * Never throws — a failure here must not fail the cancellation that triggered it.
 */
const promoteAndNotify = async (opportunityId) => {
  try {
    const promoted = await waitlistRepository.promote(opportunityId);
    if (!promoted.length) return [];

    const opp = await opportunityRepository.findOpportunityById(opportunityId);
    for (const { volunteer_id } of promoted) {
      const user = await userRepository.findById(volunteer_id);
      if (!user) continue;
      await notificationService.notify({
        user,
        title: 'Moved off the waitlist',
        message: `A spot opened up — you're now registered for ${opp.title}.`,
        type: 'WAITLIST_PROMOTED',
        reference_id: opp.id,
        email: templates.waitlistPromoted({ name: user.full_name, opp }),
        attachments: [icsAttachment(opp)],
        force: true,
      });
    }
    return promoted;
  } catch (err) {
    logger.error({ err: err.message, opportunityId }, '[waitlist] promotion failed');
    return [];
  }
};

module.exports = {
  joinWaitlist,
  leaveWaitlist,
  getMyWaitlist,
  promoteAndNotify,
};
