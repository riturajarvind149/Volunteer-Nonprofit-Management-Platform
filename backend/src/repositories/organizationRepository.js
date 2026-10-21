const pool = require('../config/db');

/**
 * Data-access repository for organizations table.
 * Uses parameterized queries to prevent SQL injection.
 */

/**
 * Insert a new organization record
 * @param {Object} orgData
 * @param {string} orgData.name
 * @param {string|null} orgData.description
 * @param {string} orgData.coordinator_id
 * @returns {Promise<Object>} Created organization record
 */
const create = async ({ name, description, coordinator_id }) => {
  const query = `
    INSERT INTO organizations (name, description, coordinator_id)
    VALUES ($1, $2, $3)
    RETURNING id, name, description, coordinator_id, created_at, updated_at
  `;
  const values = [name, description || null, coordinator_id];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieve all organizations ordered by creation date descending
 * @returns {Promise<Array>} List of organizations
 */
const findAll = async () => {
  const query = `
    SELECT id, name, description, coordinator_id, phone, email, website, address, social_links, logo_url, created_at, updated_at
    FROM organizations
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Retrieve a single organization by its UUID
 * @param {string} id - Organization UUID
 * @returns {Promise<Object|null>} Organization record or null if not found
 */
const findById = async (id) => {
  const query = `
    SELECT id, name, description, coordinator_id, phone, email, website, address, social_links, logo_url, created_at, updated_at
    FROM organizations
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Verify organization ownership by organization ID and coordinator ID
 * @param {string} id - Organization UUID
 * @param {string} coordinator_id - Coordinator user UUID
 * @returns {Promise<Object|null>} Matching organization record if owned, otherwise null
 */
const findByIdAndCoordinatorId = async (id, coordinator_id) => {
  const query = `
    SELECT id, name, description, coordinator_id, phone, email, website, address, social_links, logo_url, created_at, updated_at
    FROM organizations
    WHERE id = $1
      AND coordinator_id = $2
  `;
  const { rows } = await pool.query(query, [id, coordinator_id]);
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
    RETURNING id, name, description, coordinator_id, phone, email, website, address, social_links, logo_url, created_at, updated_at
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
      (SELECT COALESCE(SUM(vh.hours), 0) 
       FROM volunteer_hours vh 
       JOIN signups s ON vh.signup_id = s.id 
       JOIN opportunities o ON s.opportunity_id = o.id 
       WHERE o.organization_id = $1) AS total_hours,
      (SELECT COALESCE(SUM(vh.hours), 0) 
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
  findAll,
  findById,
  findByIdAndCoordinatorId,
  update,
  getOrganizationImpactStats,
};

