require('dotenv').config({ quiet: true });
const pool = require('../config/db');
const { migrate } = require('./migrate');

/**
 * Backwards-compatible entry point (`npm run db:init`).
 * Database setup is now handled by the versioned migration runner.
 */
const initDb = async () => {
  await migrate();
};

if (require.main === module) {
  initDb()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[initDb] Failed to initialize database schema:', err.message);
      try {
        await pool.end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

module.exports = { initDb };
