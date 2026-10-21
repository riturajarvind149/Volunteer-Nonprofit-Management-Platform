const pool = require('../config/db');

/**
 * Data-access repository for users table
 * Uses parameterized queries to prevent SQL injection
 */

const findByEmail = async (email) => {
  const query = `
    SELECT id, full_name, email, password_hash, role, phone, location, bio, skills, avatar_url, created_at, updated_at
    FROM users
    WHERE email = $1
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const findById = async (id) => {
  const query = `
    SELECT id, full_name, email, role, phone, location, bio, skills, avatar_url, created_at, updated_at
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
    RETURNING id, full_name, email, role, phone, location, bio, skills, avatar_url, created_at, updated_at
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
  const allowedKeys = ['full_name', 'phone', 'location', 'bio', 'skills', 'avatar_url'];
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
    RETURNING id, full_name, email, role, phone, location, bio, skills, avatar_url, created_at, updated_at
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
  const query = `
    UPDATE users
    SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
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

module.exports = {
  findByEmail,
  findById,
  findPasswordHashById,
  createUser,
  updateProfile,
  updatePassword,
  getUserStats,
};
