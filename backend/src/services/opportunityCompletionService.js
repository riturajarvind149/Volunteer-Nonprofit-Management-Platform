const opportunityRepository = require('../repositories/opportunityRepository');
const notificationService = require('./notificationService');

/**
 * Service to manage automatic transition of completed opportunities
 * and dispatch attendee completion notifications.
 */

let schedulerInterval = null;
let isRunning = false;

/**
 * Resolve application timezone fallback
 * @returns {string} Timezone string (e.g., 'Asia/Kolkata')
 */
const resolveTimezone = () => {
  return process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
};

/**
 * Scan for eligible published opportunities whose scheduled end time has passed,
 * transition them to COMPLETED status, and notify registered attendees.
 *
 * @param {Object} [options]
 * @param {string} [options.timezone] - Timezone override
 * @param {string|Date|null} [options.now] - Simulated current timestamp for boundary testing
 * @returns {Promise<Object>} Execution summary
 */
const processCompletedOpportunities = async (options = {}) => {
  const timezone = options.timezone || resolveTimezone();
  const simulatedNow = options.now || null;

  const results = {
    processed_at: new Date().toISOString(),
    timezone,
    eligible_count: 0,
    completed_count: 0,
    notified_volunteers_count: 0,
    completed_opportunities: [],
    errors: [],
  };

  // 1. Identify eligible opportunities
  const eligible = await opportunityRepository.findEligibleForCompletion(timezone, simulatedNow);
  results.eligible_count = eligible.length;

  // 2. Process each opportunity with individual fault isolation
  for (const opp of eligible) {
    try {
      // Atomic status transition: PUBLISHED -> COMPLETED
      const updated = await opportunityRepository.markCompletedIfPublished(opp.id);
      if (!updated) {
        // Concurrently transitioned or modified; safely skip
        continue;
      }

      results.completed_count++;

      // Query registered attendees who haven't yet received an EVENT_COMPLETED notification
      const attendees = await opportunityRepository.findRegisteredAttendeesWithoutCompletionNotification(opp.id);

      for (const attendee of attendees) {
        await notificationService.createNotification({
          user_id: attendee.volunteer_id,
          title: 'Event Completed',
          message: `${opp.title} has completed! Please log your volunteer hours to get them verified.`,
          type: 'EVENT_COMPLETED',
          reference_id: opp.id,
        });
        results.notified_volunteers_count++;
      }

      results.completed_opportunities.push({
        id: opp.id,
        title: opp.title,
        attendees_notified: attendees.length,
      });
    } catch (err) {
      console.error(`[OpportunityCompletionService] Failed to process opportunity ${opp.id}:`, err.message);
      results.errors.push({
        opportunity_id: opp.id,
        error: err.message,
      });
    }
  }

  return results;
};

/**
 * Start the recurring background scheduler for opportunity completion
 * @param {number} [customIntervalMs] - Optional polling interval in ms
 * @returns {NodeJS.Timeout|null} Active timer handle
 */
const startOpportunityCompletionScheduler = (customIntervalMs = null) => {
  if (schedulerInterval) {
    return schedulerInterval;
  }

  const intervalMs = customIntervalMs || (
    process.env.OPPORTUNITY_COMPLETION_INTERVAL_MS
      ? parseInt(process.env.OPPORTUNITY_COMPLETION_INTERVAL_MS, 10)
      : 60000 // 60 seconds default
  );

  const runCycle = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await processCompletedOpportunities();
    } catch (err) {
      console.error('[OpportunityCompletionScheduler] Unexpected failure during cycle:', err.message);
    } finally {
      isRunning = false;
    }
  };

  // Initial cycle after brief initial delay
  const initialTimer = setTimeout(runCycle, 1500);
  if (initialTimer && typeof initialTimer.unref === 'function') {
    initialTimer.unref();
  }

  schedulerInterval = setInterval(runCycle, intervalMs);
  if (schedulerInterval && typeof schedulerInterval.unref === 'function') {
    schedulerInterval.unref();
  }

  return schedulerInterval;
};

/**
 * Stop the background scheduler and reset execution state
 */
const stopOpportunityCompletionScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isRunning = false;
};

/**
 * Check scheduler running status
 */
const isSchedulerRunning = () => {
  return schedulerInterval !== null;
};

module.exports = {
  resolveTimezone,
  processCompletedOpportunities,
  startOpportunityCompletionScheduler,
  stopOpportunityCompletionScheduler,
  isSchedulerRunning,
};
