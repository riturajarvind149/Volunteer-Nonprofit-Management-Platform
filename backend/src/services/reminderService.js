const opportunityRepository = require('../repositories/opportunityRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const { config } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Send one reminder (in-app + email) to every registered volunteer of each
 * published opportunity starting within REMINDER_LEAD_HOURS.
 * claimReminder() makes this safe to run from several instances concurrently.
 */
const sendUpcomingReminders = async () => {
  const due = await opportunityRepository.findDueForReminder(config.timezone, config.reminderLeadHours);
  let sent = 0;

  for (const opp of due) {
    const claimed = await opportunityRepository.claimReminder(opp.id);
    if (!claimed) continue;
    try {
      const volunteers = await opportunityRepository.findRegisteredVolunteers(opp.id);
      for (const volunteer of volunteers) {
        await notificationService.notify({
          user: volunteer,
          title: 'Upcoming volunteer shift',
          message: `Reminder: ${opp.title} starts ${opp.event_date} at ${String(opp.start_time).slice(0, 5)}.`,
          type: 'REMINDER',
          reference_id: opp.id,
          email: templates.eventReminder({ name: volunteer.full_name, opp }),
        });
        sent += 1;
      }
    } catch (err) {
      logger.error({ err: err.message, opportunityId: opp.id }, '[reminders] failed for opportunity');
    }
  }

  return { opportunities: due.length, reminders_sent: sent };
};

module.exports = { sendUpcomingReminders };
