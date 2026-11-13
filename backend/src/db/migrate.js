require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

/**
 * Minimal, dependency-free SQL migration runner.
 *
 *  - Applies every `migrations/NNN_name.sql` file in lexical order, exactly once.
 *  - Each migration runs in its own transaction.
 *  - A PostgreSQL advisory lock prevents two deploys from migrating concurrently.
 *
 * Usage:  npm run migrate        (apply pending migrations)
 *         npm run migrate:status (list applied / pending)
 */

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_KEY = 74_213_001; // arbitrary, app-specific advisory lock id

const listMigrationFiles = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

const ensureMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getApplied = async (client) => {
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((r) => r.name));
};

const migrate = async ({ log = console.log } = {}) => {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    const pending = listMigrationFiles().filter((file) => !applied.has(file));

    if (pending.length === 0) {
      log('[migrate] Database is up to date.');
      return [];
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      log(`[migrate] Applying ${file} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    log(`[migrate] Applied ${pending.length} migration(s).`);
    return pending;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    } catch {
      // connection may already be broken; lock is released with the session
    }
    client.release();
  }
};

const status = async () => {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);
    for (const file of listMigrationFiles()) {
      console.log(`${applied.has(file) ? '[x]' : '[ ]'} ${file}`);
    }
  } finally {
    client.release();
  }
};

if (require.main === module) {
  const run = process.argv.includes('--status') ? status : migrate;
  run()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error(`[migrate] ${err.message}`);
      try {
        await pool.end();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}

module.exports = { migrate, listMigrationFiles };
