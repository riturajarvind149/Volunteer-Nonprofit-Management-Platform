const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Invitations to join an organization as a coordinator.
 * Only a hash of the emailed token is stored.
 */

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const OPEN = 'accepted_at IS NULL AND revoked_at IS NULL';

/**
 * Create an invitation, replacing any open one for the same email and organization.
 * @returns {Promise<{invitation: Object, token: string}>} the raw token (to email, never stored)
 */
const create = async ({ organizationId, email, invitedBy, ttlDays }) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE organization_invitations SET revoked_at = CURRENT_TIMESTAMP
        WHERE organization_id = $1 AND LOWER(email) = LOWER($2) AND ${OPEN}`,
      [organizationId, email]
    );
    const { rows } = await client.query(
      `INSERT INTO organization_invitations (organization_id, email, token_hash, invited_by, expires_at)
       VALUES ($1, LOWER($2), $3, $4, NOW() + ($5 || ' days')::interval)
       RETURNING id, organization_id, email, role, expires_at, created_at`,
      [organizationId, email, hashToken(token), invitedBy, String(ttlDays)]
    );
    await client.query('COMMIT');
    return { invitation: rows[0], token };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/** Open, unexpired invitation for a raw token, with the organization and inviter names. */
const findOpenByToken = async (token) => {
  const { rows } = await pool.query(
    `SELECT i.id, i.organization_id, i.email, i.role, i.expires_at, i.invited_by,
            org.name AS organization_name, org.verification_status AS organization_status,
            inviter.full_name AS invited_by_name
       FROM organization_invitations i
       JOIN organizations org ON org.id = i.organization_id
       LEFT JOIN users inviter ON inviter.id = i.invited_by
      WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()`,
    [hashToken(token)]
  );
  return rows[0] || null;
};

/** Mark an invitation accepted (inside the caller's transaction). Returns false if it was already used. */
const markAccepted = async (id, userId, client = pool) => {
  const { rowCount } = await client.query(
    `UPDATE organization_invitations SET accepted_at = CURRENT_TIMESTAMP, accepted_by = $2
      WHERE id = $1 AND ${OPEN} AND expires_at > NOW()`,
    [id, userId]
  );
  return rowCount > 0;
};

/** Open invitations of an organization (pending and not yet expired), newest first. */
const findOpenByOrganization = async (organizationId) => {
  const { rows } = await pool.query(
    `SELECT i.id, i.email, i.role, i.expires_at, i.created_at, inviter.full_name AS invited_by_name
       FROM organization_invitations i
       LEFT JOIN users inviter ON inviter.id = i.invited_by
      WHERE i.organization_id = $1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()
      ORDER BY i.created_at DESC`,
    [organizationId]
  );
  return rows;
};

/** Number of invitations an organization sent in the last 24 hours (abuse guard). */
const countRecent = async (organizationId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM organization_invitations
      WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [organizationId]
  );
  return rows[0].n;
};

/** Cancel an open invitation. Returns false if it doesn't exist or isn't open. */
const revoke = async (organizationId, invitationId) => {
  const { rowCount } = await pool.query(
    `UPDATE organization_invitations SET revoked_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2 AND ${OPEN}`,
    [invitationId, organizationId]
  );
  return rowCount > 0;
};

module.exports = { create, findOpenByToken, markAccepted, findOpenByOrganization, countRecent, revoke };
