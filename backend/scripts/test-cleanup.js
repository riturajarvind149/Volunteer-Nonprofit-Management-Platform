/**
 * Test data cleanup.
 *
 * 1. As a helper, used by test suites in their `finally` blocks:
 *      const { cleanupTestUsers } = require('./scripts/test-cleanup');
 *      await cleanupTestUsers(pool, [coord.email, volunteer.email]);
 *
 * 2. As a one-off command that purges every leftover test account
 *    (emails ending in @test.org or @prodtest.org) from a development database:
 *      npm run test:cleanup
 *    It refuses to run when NODE_ENV=production.
 */

const TEST_EMAIL_PATTERNS = ['%@test.org', '%@prodtest.org'];

/**
 * Remove the given users and everything that depends on them, in foreign-key-safe order:
 * hours → organizations (cascades opportunities, signups, waitlist) → users
 * (cascades their own signups, notifications, tokens and waitlist entries).
 *
 * @param {import('pg').Pool} pool
 * @param {string[]} [emails] - exact emails to remove
 * @param {{patterns?: string[]}} [opts] - SQL LIKE patterns instead of / in addition to emails
 * @returns {Promise<number>} number of users removed
 */
const cleanupTestUsers = async (pool, emails = [], { patterns = [] } = {}) => {
  const list = emails.filter(Boolean).map((e) => e.toLowerCase());
  if (list.length === 0 && patterns.length === 0) return 0;

  const { rows } = await pool.query(
    `SELECT id FROM users
      WHERE LOWER(email) = ANY($1::text[])
         OR LOWER(email) LIKE ANY($2::text[])`,
    [list, patterns]
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Hours recorded by, recorded for, or belonging to these users' organizations.
    await client.query(
      `DELETE FROM volunteer_hours
        WHERE recorded_by = ANY($1::uuid[])
           OR signup_id IN (SELECT id FROM signups WHERE volunteer_id = ANY($1::uuid[]))
           OR signup_id IN (
                SELECT s.id FROM signups s
                  JOIN opportunities o ON o.id = s.opportunity_id
                  JOIN organizations org ON org.id = o.organization_id
                 WHERE org.coordinator_id = ANY($1::uuid[]))`,
      [ids]
    );
    await client.query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($1::uuid[])', [ids]);
    await client.query(
      `DELETE FROM audit_logs
        WHERE entity_id IN (SELECT id FROM organizations WHERE coordinator_id = ANY($1::uuid[]))`,
      [ids]
    );
    await client.query('DELETE FROM organizations WHERE coordinator_id = ANY($1::uuid[])', [ids]);
    await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    await client.query('COMMIT');
    return ids.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { cleanupTestUsers, TEST_EMAIL_PATTERNS };

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  if (process.env.NODE_ENV === 'production') {
    console.error('[test:cleanup] Refusing to run with NODE_ENV=production.');
    process.exit(1);
  }
  const pool = require('../src/config/db');
  cleanupTestUsers(pool, [], { patterns: TEST_EMAIL_PATTERNS })
    .then((n) => console.log(`[test:cleanup] Removed ${n} test account(s) and their data.`))
    .catch((err) => {
      console.error(`[test:cleanup] ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
