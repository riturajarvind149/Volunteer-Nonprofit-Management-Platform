const crypto = require('crypto');
const pool = require('../config/db');

/**
 * One-time tokens for email verification and password reset.
 * Only a SHA-256 hash of the token is stored, so a database leak does not
 * expose usable links.
 */

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Create a token, invalidating any previous unused token of the same type.
 * @returns {Promise<string>} the raw token (to be emailed, never stored)
 */
const issue = async (userId, type, ttlMinutes) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND type = $2 AND used_at IS NULL`,
      [userId, type]
    );
    await client.query(
      `INSERT INTO auth_tokens (user_id, type, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)`,
      [userId, type, hashToken(token), String(ttlMinutes)]
    );
    await client.query('COMMIT');
    return token;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Atomically consume a valid token.
 * @returns {Promise<{user_id: string}|null>}
 */
const consume = async (token, type) => {
  const { rows } = await pool.query(
    `UPDATE auth_tokens
        SET used_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
        AND type = $2
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING user_id`,
    [hashToken(token), type]
  );
  return rows[0] || null;
};

/** Number of tokens of a type issued for a user in the last hour (abuse guard). */
const countRecent = async (userId, type) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM auth_tokens
      WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId, type]
  );
  return rows[0].n;
};

module.exports = { issue, consume, countRecent, hashToken };
