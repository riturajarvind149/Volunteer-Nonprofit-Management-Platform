const crypto = require('crypto');
const pool = require('../config/db');

/**
 * One-time tokens for email verification and password reset.
 * Each token has two forms the user can use:
 *  - a long random token for the link in the email
 *  - a 6-digit code to type in on the website (works on any device)
 * Only hashes are stored, so a database leak does not expose usable links or codes.
 */

/** Wrong code entries allowed before the code (and its link) stops working. */
const MAX_CODE_ATTEMPTS = 5;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Codes are short, so they are hashed with a server secret and bound to the user and purpose. */
const hashCode = (userId, type, code) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'servehub-code-key')
    .update(`${userId}:${type}:${code}`)
    .digest('hex');

const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Create a token + code, invalidating any previous unused token of the same type.
 * @returns {Promise<{token: string, code: string}>} raw values (to be emailed, never stored)
 */
const issue = async (userId, type, ttlMinutes) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const code = newCode();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND type = $2 AND used_at IS NULL`,
      [userId, type]
    );
    await client.query(
      `INSERT INTO auth_tokens (user_id, type, token_hash, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)`,
      [userId, type, hashToken(token), hashCode(userId, type, code), String(ttlMinutes)]
    );
    await client.query('COMMIT');
    return { token, code };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Atomically consume a valid link token.
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

/**
 * Check a 6-digit code against the user's current token of that type.
 * A wrong code counts as an attempt; after MAX_CODE_ATTEMPTS the token is invalidated.
 * @returns {Promise<{status: 'ok'} | {status: 'none'} | {status: 'wrong', remaining: number}>}
 */
const consumeCode = async (userId, type, code) => {
  const { rows } = await pool.query(
    `SELECT id, code_hash FROM auth_tokens
      WHERE user_id = $1 AND type = $2 AND used_at IS NULL AND expires_at > NOW() AND code_hash IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, type]
  );
  const current = rows[0];
  if (!current) return { status: 'none' };

  const expected = Buffer.from(current.code_hash, 'hex');
  const given = Buffer.from(hashCode(userId, type, code), 'hex');
  if (crypto.timingSafeEqual(expected, given)) {
    const used = await pool.query(
      `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()
        RETURNING id`,
      [current.id]
    );
    return used.rowCount ? { status: 'ok' } : { status: 'none' };
  }

  const { rows: updated } = await pool.query(
    `UPDATE auth_tokens
        SET attempts = attempts + 1,
            used_at = CASE WHEN attempts + 1 >= $2 THEN CURRENT_TIMESTAMP ELSE used_at END
      WHERE id = $1 AND used_at IS NULL
      RETURNING attempts`,
    [current.id, MAX_CODE_ATTEMPTS]
  );
  const attempts = updated[0]?.attempts ?? MAX_CODE_ATTEMPTS;
  return { status: 'wrong', remaining: Math.max(0, MAX_CODE_ATTEMPTS - attempts) };
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

module.exports = { issue, consume, consumeCode, countRecent, hashToken, MAX_CODE_ATTEMPTS };
