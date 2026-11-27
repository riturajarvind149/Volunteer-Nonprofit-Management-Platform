const pool = require('../config/db');
const { memberOf } = require('./organizationMemberRepository');

const ORG_COLUMNS =
  'id, name, description, phone, email, website, address, social_links, logo_url, ' +
  'registration_type, registration_number, city, ' +
  'verification_status, verification_note, verified_at, closed_at, created_at, updated_at';

/** `my_role` column: the viewer's role in each organization (OWNER / COORDINATOR / null). */
const myRole = (userParam) =>
  `(SELECT om.role FROM organization_members om WHERE om.organization_id = organizations.id AND om.user_id = ${userParam}) AS my_role`;

/**
 * Data-access repository for organizations table.
 * Uses parameterized queries to prevent SQL injection.
 */

/**
 * Create an organization and make `ownerId` its owner.
 * Runs inside the caller's transaction when `client` is given, otherwise in its own.
 * @returns {Promise<Object>} Created organization record (with my_role = 'OWNER')
 */
const create = async (
  { name, description, ownerId, verification_status = 'PENDING', registration_type = null, registration_number = null, city = null, website = null },
  client = null
) => {
  const insert = async (db) => {
    const { rows } = await db.query(
      `INSERT INTO organizations
         (name, description, verification_status, verified_at, registration_type, registration_number, city, website)
       VALUES ($1, $2, $3::varchar, CASE WHEN $3::varchar = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END, $4, $5, $6, $7)
       RETURNING ${ORG_COLUMNS}`,
      [name, description || null, verification_status, registration_type, registration_number, city, website]
    );
    await db.query(
      `INSERT INTO organization_members (organization_id, user_id, role, added_by) VALUES ($1, $2, 'OWNER', $2)`,
      [rows[0].id, ownerId]
    );
    return { ...rows[0], my_role: 'OWNER' };
  };

  if (client) return insert(client);
  const own = await pool.connect();
  try {
    await own.query('BEGIN');
    const organization = await insert(own);
    await own.query('COMMIT');
    return organization;
  } catch (err) {
    await own.query('ROLLBACK');
    throw err;
  } finally {
    own.release();
  }
};

/** An organization with this name (any letter case) that hasn't been rejected, or null. */
const findActiveByName = async (name) => {
  const { rows } = await pool.query(
    `SELECT id, name FROM organizations WHERE LOWER(name) = LOWER($1) AND verification_status NOT IN ('REJECTED', 'CLOSED') LIMIT 1`,
    [name]
  );
  return rows[0] || null;
};

/**
 * Search organizations with visibility rules applied.
 * @param {Object} opts
 * @param {string} [opts.q] - name/description search
 * @param {string[]} [opts.statuses] - allowed verification statuses (undefined = any)
 * @param {string} [opts.includeMemberId] - always include organizations this user is a member of
 * @param {string} [opts.viewerId] - adds `my_role` for this user
 * @param {number} opts.limit
 * @param {number} opts.offset
 */
const search = async ({ q, statuses, includeMemberId, viewerId, limit = 100, offset = 0 }) => {
  const values = [];
  const visibility = [];
  if (statuses) {
    values.push(statuses);
    visibility.push(`verification_status = ANY($${values.length})`);
  }
  if (includeMemberId) {
    values.push(includeMemberId);
    visibility.push(memberOf('organizations.id', `$${values.length}`));
  }
  const where = [];
  if (visibility.length) where.push(`(${visibility.join(' OR ')})`);
  if (q) {
    values.push(`%${q}%`);
    where.push(`(name ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM organizations ${whereSql}`, values)).rows[0].n;
  let roleColumn = 'NULL::varchar AS my_role';
  if (viewerId) {
    values.push(viewerId);
    roleColumn = myRole(`$${values.length}`);
  }
  values.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ${ORG_COLUMNS}, ${roleColumn},
            (SELECT COUNT(*)::int FROM opportunities o
              WHERE o.organization_id = organizations.id AND o.status = 'PUBLISHED' AND o.event_date >= CURRENT_DATE) AS open_opportunities
       FROM organizations ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { organizations: rows, total };
};

/** Organizations the user is a member of (owner or coordinator), with their role. */
const findByMember = async (userId) => {
  const { rows } = await pool.query(
    `SELECT ${ORG_COLUMNS}, ${myRole('$1')}
       FROM organizations
      WHERE ${memberOf('organizations.id', '$1')}
      ORDER BY created_at ASC`,
    [userId]
  );
  return rows;
};

/** Set verification status (admin). */
const setVerification = async (id, { status, note, adminId }) => {
  const { rows } = await pool.query(
    `UPDATE organizations
        SET verification_status = $2::varchar,
            verification_note = $3,
            verified_at = CASE WHEN $2::varchar = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE verified_at END,
            verified_by = $4,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING ${ORG_COLUMNS}`,
    [id, status, note || null, adminId]
  );
  return rows[0] || null;
};

/**
 * Close an organization in one transaction (admin):
 *  - status CLOSED with the reason as its note,
 *  - every upcoming DRAFT / PUBLISHED event is cancelled and its waitlist cleared,
 *  - all team memberships are removed.
 * Past events, signups and hours are kept.
 * @returns {Promise<{organization: Object, members: Object[], cancelledOpportunityIds: string[]}|null>}
 *   null when the organization doesn't exist or is already closed.
 */
const close = async (id, { reason, adminId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      "SELECT id FROM organizations WHERE id = $1 AND verification_status <> 'CLOSED' FOR UPDATE",
      [id]
    );
    if (!locked.rows.length) {
      await client.query('ROLLBACK');
      return null;
    }

    const { rows: orgRows } = await client.query(
      `UPDATE organizations
          SET verification_status = 'CLOSED', verification_note = $2, verified_by = $3,
              closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING ${ORG_COLUMNS}`,
      [id, reason, adminId]
    );

    const { rows: cancelled } = await client.query(
      `UPDATE opportunities
          SET status = 'CANCELLED', cancellation_reason = 'The organizing NGO has closed.',
              updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $1 AND status IN ('DRAFT', 'PUBLISHED') AND event_date >= CURRENT_DATE
        RETURNING id`,
      [id]
    );
    const cancelledOpportunityIds = cancelled.map((r) => r.id);
    if (cancelledOpportunityIds.length) {
      await client.query('DELETE FROM waitlist_entries WHERE opportunity_id = ANY($1)', [cancelledOpportunityIds]);
    }

    const { rows: members } = await client.query(
      `DELETE FROM organization_members om
        USING users u
        WHERE om.organization_id = $1 AND u.id = om.user_id
        RETURNING u.id, u.full_name, u.email, u.email_notifications, om.role`,
      [id]
    );

    await client.query('COMMIT');
    return { organization: orgRows[0], members, cancelledOpportunityIds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Retrieve a single organization by its UUID.
 * @param {string} id - Organization UUID
 * @param {string} [viewerId] - adds `my_role` for this user
 * @returns {Promise<Object|null>} Organization record or null if not found
 */
const findById = async (id, viewerId = null) => {
  const { rows } = await pool.query(
    `SELECT ${ORG_COLUMNS}, ${myRole('$2::uuid')} FROM organizations WHERE id = $1`,
    [id, viewerId]
  );
  return rows[0] || null;
};

/**
 * The organization, if the user is a member of it (owner or coordinator).
 * @returns {Promise<Object|null>} Organization record with `my_role`, or null
 */
const findManagedById = async (id, userId) => {
  const { rows } = await pool.query(
    `SELECT ${ORG_COLUMNS}, ${myRole('$2')} FROM organizations WHERE id = $1 AND ${memberOf('organizations.id', '$2')}`,
    [id, userId]
  );
  return rows[0] || null;
};

/**
 * Update organization profile fields
 * @param {string} id - Organization UUID
 * @param {Object} updateFields - Key-value pairs to update
 * @returns {Promise<Object>} Updated organization record
 */
const update = async (id, updateFields) => {
  const allowedKeys = ['name', 'description', 'phone', 'email', 'website', 'address', 'social_links', 'logo_url'];
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const key of allowedKeys) {
    if (updateFields[key] !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(key === 'social_links' && typeof updateFields[key] === 'object' ? JSON.stringify(updateFields[key]) : updateFields[key]);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return await findById(id);
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `
    UPDATE organizations
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING ${ORG_COLUMNS}
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieve organization impact summary metrics
 * @param {string} id - Organization UUID
 * @returns {Promise<Object>} Impact statistics
 */
const getOrganizationImpactStats = async (id) => {
  const query = `
    SELECT
      (SELECT COUNT(*)::int FROM opportunities WHERE organization_id = $1) AS total_opportunities,
      (SELECT COUNT(*)::int FROM opportunities WHERE organization_id = $1 AND status = 'PUBLISHED' AND event_date >= CURRENT_DATE) AS active_opportunities,
      (SELECT COUNT(*)::int FROM opportunities WHERE organization_id = $1 AND (status = 'COMPLETED' OR event_date < CURRENT_DATE)) AS completed_events,
      (SELECT COUNT(DISTINCT s.volunteer_id)::int 
       FROM signups s 
       JOIN opportunities o ON s.opportunity_id = o.id 
       WHERE o.organization_id = $1 AND s.status = 'REGISTERED') AS total_volunteers,
      (SELECT COUNT(DISTINCT s.volunteer_id)::int 
       FROM signups s 
       JOIN opportunities o ON s.opportunity_id = o.id 
       WHERE o.organization_id = $1 AND s.status = 'REGISTERED' 
         AND DATE_TRUNC('month', o.event_date) = DATE_TRUNC('month', CURRENT_DATE)) AS active_volunteers_this_month,
      (SELECT COALESCE(SUM(vh.hours) FILTER (WHERE vh.status <> 'REJECTED'), 0) 
       FROM volunteer_hours vh 
       JOIN signups s ON vh.signup_id = s.id 
       JOIN opportunities o ON s.opportunity_id = o.id 
       WHERE o.organization_id = $1) AS total_hours,
      (SELECT COALESCE(SUM(vh.hours) FILTER (WHERE vh.status <> 'REJECTED'), 0) 
       FROM volunteer_hours vh 
       JOIN signups s ON vh.signup_id = s.id 
       JOIN opportunities o ON s.opportunity_id = o.id 
       WHERE o.organization_id = $1 AND vh.status = 'VERIFIED') AS verified_hours,
      (SELECT COALESCE(
        ROUND(
          (SUM(COALESCE(sub.reg_count, 0))::numeric / NULLIF(SUM(o.capacity), 0)::numeric) * 100, 
          1
        ), 0
       )
       FROM opportunities o
       LEFT JOIN (
         SELECT opportunity_id, COUNT(*)::int AS reg_count
         FROM signups
         WHERE status = 'REGISTERED'
         GROUP BY opportunity_id
       ) sub ON sub.opportunity_id = o.id
       WHERE o.organization_id = $1
      ) AS event_fill_rate
  `;

  const { rows } = await pool.query(query, [id]);
  const r = rows[0] || {};
  const totalHours = parseFloat(Number(r.total_hours || 0).toFixed(2));
  const verifiedHours = parseFloat(Number(r.verified_hours || 0).toFixed(2));
  const verificationRate = totalHours > 0 ? parseFloat(((verifiedHours / totalHours) * 100).toFixed(1)) : 0;

  return {
    total_opportunities: parseInt(r.total_opportunities || 0, 10),
    active_opportunities: parseInt(r.active_opportunities || 0, 10),
    completed_events: parseInt(r.completed_events || 0, 10),
    total_volunteers: parseInt(r.total_volunteers || 0, 10),
    active_volunteers_this_month: parseInt(r.active_volunteers_this_month || 0, 10),
    total_hours: totalHours,
    verified_hours: verifiedHours,
    event_fill_rate: parseFloat(Number(r.event_fill_rate || 0).toFixed(1)),
    hour_verification_rate: verificationRate,
  };
};

module.exports = {
  create,
  findActiveByName,
  findById,
  findManagedById,
  update,
  getOrganizationImpactStats,
  search,
  findByMember,
  setVerification,
  close,
};

