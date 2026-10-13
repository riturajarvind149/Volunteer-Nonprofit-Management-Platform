require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

/**
 * Explicit database initialization script for newly provisioned databases.
 * Reads and executes src/db/schema.sql against the configured DATABASE_URL.
 *
 * This script is intended to be executed on-demand (e.g. Render pre-deploy
 * or manual database setup) and is NOT run automatically on server start.
 */
const initDb = async () => {
  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[initDb] Executing schema.sql against PostgreSQL database...');
  await pool.query(schemaSql);
  console.log('[initDb] Database schema initialized successfully.');
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
      } catch (poolErr) {
        console.error('[initDb] Error closing pool:', poolErr.message);
      }
      process.exit(1);
    });
}

module.exports = { initDb };
