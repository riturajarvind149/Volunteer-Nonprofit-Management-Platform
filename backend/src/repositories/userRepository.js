const pool = require('../config/db');

const PUBLIC_COLUMNS =
  'id, full_name, email, role, phone, location, bio, skills, avatar_url, email_verified_at, is_active, email_notifications, last_login_at, created_at, updated_at';

/**
 * Data-access repository for users table
 * Uses parameterized queries to prevent SQL injection
 */

const findByEmail = async (email) => {
  const query = `
    SELECT ${PUBLIC_COLUMNS}, password_hash, token_version
    FROM users
    WHERE LOWER(email) = LOWER($1)
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const findById = async (id) => {
  const query = `
    SELECT ${PUBLIC_COLUMNS}
    FROM users
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const findPasswordHashById = async (id) => {
  const query = `
    SELECT password_hash
    FROM users
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0]?.password_hash || null;
};

const createUser = async ({ full_name, email, password_hash, role }) => {
  const query = `
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING ${PUBLIC_COLUMNS}
  `;
  const values = [full_name, email, password_hash, role];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Update user profile fields (dynamic parameterized update)
 * @param {string} id - User UUID
 * @param {Object} updateFields - Fields to update
 * @returns {Promise<Object>} Updated user record
 */
const updateProfile = async (id, updateFields) => {
  const allowedKeys = ['full_name', 'phone', 'location', 'bio', 'skills', 'avatar_url', 'email_notifications'];
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const key of allowedKeys) {
    if (updateFields[key] !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(updateFields[key]);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return await findById(id);
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING ${PUBLIC_COLUMNS}
  `;

  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Update user password hash
 * @param {string} id - User UUID
 * @param {string} passwordHash - New bcrypt hash
 * @returns {Promise<boolean>} True if updated
 */
const updatePassword = async (id, passwordHash) => {
  // Bumping token_version revokes every previously issued JWT for this user.
  const query = `
    UPDATE users
    SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `;
  const result = await pool.query(query, [passwordHash, id]);
  return result.rowCount > 0;
};

/**
 * Retrieve user's high-level impact metrics for profile display
 * @param {string} userId - User UUID
 * @param {string} role - 'VOLUNTEER' or 'COORDINATOR'
 * @returns {Promise<Object>} Profile stats
 */
const getUserStats = async (userId, role) => {
  if (role === 'VOLUNTEER') {
    const query = `
      SELECT
        (SELECT COALESCE(SUM(vh.hours), 0)
         FROM volunteer_hours vh
         JOIN signups s ON vh.signup_id = s.id
         WHERE s.volunteer_id = $1
        ) AS total_hours,
        (SELECT COUNT(DISTINCT s.opportunity_id)::int
         FROM signups s
         JOIN opportunities o ON s.opportunity_id = o.id
         WHERE s.volunteer_id = $1
           AND s.status = 'REGISTERED'
           AND (o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE)
        ) AS completed_events,
        (SELECT COUNT(DISTINCT o.organization_id)::int
         FROM signups s
         JOIN opportunities o ON s.opportunity_id = o.id
         WHERE s.volunteer_id = $1 AND s.status = 'REGISTERED'
        ) AS organizations_supported
    `;
    const { rows } = await pool.query(query, [userId]);
    const r = rows[0] || {};
    return {
      total_hours: parseFloat(Number(r.total_hours || 0).toFixed(2)),
      completed_events: parseInt(r.completed_events || 0, 10),
      organizations_supported: parseInt(r.organizations_supported || 0, 10),
    };
  } else {
    const query = `
      SELECT
        (SELECT COUNT(o.id)::int
         FROM opportunities o
         JOIN organizations org ON o.organization_id = org.id
         WHERE org.coordinator_id = $1
        ) AS total_opportunities,
        (SELECT COUNT(DISTINCT s.volunteer_id)::int
         FROM signups s
         JOIN opportunities o ON s.opportunity_id = o.id
         JOIN organizations org ON o.organization_id = org.id
         WHERE org.coordinator_id = $1 AND s.status = 'REGISTERED'
        ) AS total_volunteers,
        (SELECT COALESCE(SUM(vh.hours), 0)
         FROM volunteer_hours vh
         JOIN signups s ON vh.signup_id = s.id
         JOIN opportunities o ON s.opportunity_id = o.id
         JOIN organizations org ON o.organization_id = org.id
         WHERE org.coordinator_id = $1
        ) AS total_hours
    `;
    const { rows } = await pool.query(query, [userId]);
    const r = rows[0] || {};
    return {
      total_opportunities: parseInt(r.total_opportunities || 0, 10),
      total_volunteers: parseInt(r.total_volunteers || 0, 10),
      total_hours: parseFloat(Number(r.total_hours || 0).toFixed(2)),
    };
  }
};

/**
 * Minimal auth state used by the authenticate middleware on every request.
 */
const findAuthStateById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, role, is_active, token_version FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

const markEmailVerified = async (id) => {
  const { rows } = await pool.query(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id]
  );
  return rows[0] || null;
};

const incrementTokenVersion = async (id) => {
  const { rows } = await pool.query(
    'UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
    [id]
  );
  return rows[0]?.token_version;
};

const touchLastLogin = async (id) => {
  await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
};

const setActive = async (id, isActive) => {
  const { rows } = await pool.query(
    `UPDATE users
        SET is_active = $2::boolean,
            token_version = CASE WHEN $2::boolean THEN token_version ELSE token_version + 1 END,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING ${PUBLIC_COLUMNS}`,
    [id, isActive]
  );
  return rows[0] || null;
};

const findAdmins = async () => {
  const { rows } = await pool.query(
    "SELECT id, full_name, email, email_notifications FROM users WHERE role = 'ADMIN' AND is_active = TRUE"
  );
  return rows;
};

/**
 * Paginated user search for the admin console.
 */
const searchUsers = async ({ q, role, page = 1, limit = 20 }) => {
  const where = [];
  const values = [];
  if (q) {
    values.push(`%${q}%`);
    where.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
  }
  if (role) {
    values.push(role);
    where.push(`role = $${values.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users ${whereSql}`, values);
  values.push(limit, (page - 1) * limit);
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { users: rows, total: countResult.rows[0].total };
};

/**
 * Permanently remove a user and their personal data.
 * volunteer_hours.recorded_by uses ON DELETE RESTRICT, so the volunteer's own
 * hour records are removed first inside the same transaction.
 */
const deleteUserCascade = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM volunteer_hours
        WHERE signup_id IN (SELECT id FROM signups WHERE volunteer_id = $1)
           OR recorded_by = $1`,
      [id]
    );
    const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  findByEmail,
  findById,
  findPasswordHashById,
  createUser,
  updateProfile,
  updatePassword,
  getUserStats,
  findAuthStateById,
  markEmailVerified,
  incrementTokenVersion,
  touchLastLogin,
  setActive,
  findAdmins,
  searchUsers,
  deleteUserCascade,
  PUBLIC_COLUMNS,
};
