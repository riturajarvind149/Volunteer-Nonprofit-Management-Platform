const pool = require('../config/db');

/**
 * Organization membership: which users manage which organizations (NGOs).
 * OWNER = the NGO admin, COORDINATOR = staff appointed by the NGO.
 */

/**
 * SQL condition: "user `userParam` is a member of organization `orgIdSql`".
 * Used in WHERE clauses so every "my organizations" filter means the same thing.
 * @param {string} orgIdSql - SQL expression for the organization id (e.g. 'org.id')
 * @param {string} userParam - placeholder holding the user id (e.g. '$1')
 */
const memberOf = (orgIdSql, userParam) =>
  `EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = ${orgIdSql} AND om.user_id = ${userParam})`;

/** Add a member (no-op if already a member). Pass a transaction client to join a transaction. */
const add = async ({ organizationId, userId, role, addedBy = null }, client = pool) => {
  const { rows } = await client.query(
    `INSERT INTO organization_members (organization_id, user_id, role, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, user_id) DO NOTHING
     RETURNING organization_id, user_id, role, created_at`,
    [organizationId, userId, role, addedBy]
  );
  return rows[0] || null;
};

/** The user's role in the organization ('OWNER' | 'COORDINATOR'), or null if not a member. */
const findRole = async (organizationId, userId) => {
  if (!organizationId || !userId) return null;
  const { rows } = await pool.query(
    'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [organizationId, userId]
  );
  return rows[0]?.role || null;
};

/** Whether the user owns (is the NGO admin of) any organization. */
const ownsAnOrganization = async (userId) => {
  const { rows } = await pool.query(
    "SELECT 1 FROM organization_members WHERE user_id = $1 AND role = 'OWNER' LIMIT 1",
    [userId]
  );
  return rows.length > 0;
};

/** Everyone who manages the organization, owner first. */
const findMembers = async (organizationId) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.email_notifications, om.role, om.created_at AS member_since
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
      WHERE om.organization_id = $1 AND u.is_active = TRUE
      ORDER BY (om.role = 'OWNER') DESC, om.created_at ASC`,
    [organizationId]
  );
  return rows;
};

/** Remove a coordinator (never the owner). Returns false if they weren't a coordinator of it. */
const removeCoordinator = async (organizationId, userId) => {
  const { rowCount } = await pool.query(
    "DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND role = 'COORDINATOR'",
    [organizationId, userId]
  );
  return rowCount > 0;
};

/**
 * Make a coordinator the owner; the current owner becomes a coordinator.
 * Demote first: the schema allows exactly one owner per organization.
 */
const transferOwnership = async (organizationId, fromUserId, toUserId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const demoted = await client.query(
      "UPDATE organization_members SET role = 'COORDINATOR' WHERE organization_id = $1 AND user_id = $2 AND role = 'OWNER'",
      [organizationId, fromUserId]
    );
    const promoted = await client.query(
      "UPDATE organization_members SET role = 'OWNER' WHERE organization_id = $1 AND user_id = $2 AND role = 'COORDINATOR'",
      [organizationId, toUserId]
    );
    if (!demoted.rowCount || !promoted.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { memberOf, add, findRole, findMembers, ownsAnOrganization, removeCoordinator, transferOwnership };
