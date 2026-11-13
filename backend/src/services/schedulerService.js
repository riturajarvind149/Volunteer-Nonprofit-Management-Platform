const pool = require('../config/db');
const logger = require('../utils/logger');
const {
  startOpportunityCompletionScheduler,
  stopOpportunityCompletionScheduler,
} = require('./opportunityCompletionService');
const { sendUpcomingReminders } = require('./reminderService');

/**
 * Background jobs.
 *
 *  - Opportunity auto-completion (existing service, every minute by default)
 *  - Event reminders (every REMINDER_INTERVAL_MS, default 5 minutes)
 *  - Housekeeping: purge expired auth tokens (hourly)
 *
 * Jobs that must not overlap across instances take a PostgreSQL advisory lock.
 */

const timers = [];
const REMINDER_LOCK = 74_213_101;
const CLEANUP_LOCK = 74_213_102;

const withAdvisoryLock = async (key, fn) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [key]);
    if (!rows[0].locked) return null;
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key]);
    }
  } finally {
    client.release();
  }
};

const every = (ms, name, job) => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      logger.error({ err: err.message }, `[scheduler] ${name} failed`);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(run, 5000);
  first.unref();
  const interval = setInterval(run, ms);
  interval.unref();
  timers.push(first, interval);
};

const startSchedulers = () => {
  startOpportunityCompletionScheduler();

  every(parseInt(process.env.REMINDER_INTERVAL_MS || '300000', 10), 'reminders', () =>
    withAdvisoryLock(REMINDER_LOCK, async () => {
      const result = await sendUpcomingReminders();
      if (result.reminders_sent) logger.info(result, '[scheduler] reminders sent');
    })
  );

  every(60 * 60 * 1000, 'cleanup', () =>
    withAdvisoryLock(CLEANUP_LOCK, async () => {
      await pool.query(
        "DELETE FROM auth_tokens WHERE expires_at < NOW() - INTERVAL '7 days' OR used_at < NOW() - INTERVAL '7 days'"
      );
      await pool.query(
        "DELETE FROM notifications WHERE is_read = TRUE AND created_at < NOW() - INTERVAL '180 days'"
      );
    })
  );
};

const stopSchedulers = () => {
  stopOpportunityCompletionScheduler();
  while (timers.length) {
    const t = timers.pop();
    clearTimeout(t);
    clearInterval(t);
  }
};

module.exports = { startSchedulers, stopSchedulers, withAdvisoryLock };
