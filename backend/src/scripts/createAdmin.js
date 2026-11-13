require('dotenv').config({ quiet: true });
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { migrate } = require('../db/migrate');
const { validatePasswordStrength } = require('../services/authService');

/**
 * Create (or promote) a platform administrator.
 *
 *   ADMIN_EMAIL=admin@example.org ADMIN_PASSWORD='S3cure-pass' ADMIN_NAME='Platform Admin' npm run create-admin
 *
 * If the email already exists the account is promoted to ADMIN (password unchanged
 * unless ADMIN_PASSWORD is provided). Admin accounts are never creatable via the API.
 */
const run = async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = (process.env.ADMIN_NAME || 'Platform Admin').trim();

  if (!email) throw new Error('ADMIN_EMAIL is required');

  await migrate({ log: () => {} });

  const existing = (await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email])).rows[0];
  if (existing) {
    const params = [existing.id];
    let sql = "UPDATE users SET role = 'ADMIN', is_active = TRUE, email_verified_at = COALESCE(email_verified_at, NOW()), token_version = token_version + 1";
    if (password) {
      validatePasswordStrength(password);
      params.push(await bcrypt.hash(password, 12));
      sql += ', password_hash = $2';
    }
    await pool.query(`${sql} WHERE id = $1`, params);
    console.log(`[create-admin] ${email} promoted to ADMIN.`);
    return;
  }

  if (!password) throw new Error('ADMIN_PASSWORD is required to create a new admin');
  validatePasswordStrength(password);
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, email_verified_at)
     VALUES ($1, $2, $3, 'ADMIN', NOW())`,
    [name, email, hash]
  );
  console.log(`[create-admin] Admin account created for ${email}.`);
};

run()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(`[create-admin] ${err.message}`);
    await pool.end().catch(() => {});
    process.exit(1);
  });
