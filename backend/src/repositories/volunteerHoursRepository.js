const pool = require('../config/db');

/**
 * Data-access repository for volunteer_hours table.
 * Uses parameterized queries to prevent SQL injection.
 */

/**
 * Insert a new volunteer_hours record
 * @param {Object} data
 * @param {string} data.signup_id - Signup UUID
 * @param {number} data.hours - Number of hours
 * @param {string} data.status - Status (PENDING, RECORDED, VERIFIED)
 * @param {string} data.recorded_by - Coordinator UUID
 * @returns {Promise<Object>} Created volunteer_hours record
 */
const create = async ({ signup_id, hours, status = 'RECORDED', recorded_by }) => {
  const query = `
    INSERT INTO volunteer_hours (
      signup_id,
      hours,
      status,
      recorded_by
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id, signup_id, hours, status, recorded_by, created_at, updated_at
  `;

  const values = [signup_id, hours, status, recorded_by];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieve all volunteer hours for a signup
 * @param {string} signupId - Signup UUID
 * @returns {Promise<Array>} List of volunteer_hours records
 */
const findBySignupId = async (signupId) => {
  const query = `
    SELECT id, signup_id, hours, status, recorded_by, created_at, updated_at
    FROM volunteer_hours
    WHERE signup_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(query, [signupId]);
  return rows;
};

/**
 * Retrieve a single volunteer_hours record by ID
 * @param {string} id - Volunteer hours UUID
 * @returns {Promise<Object|null>} Record or null if not found
 */
const findById = async (id) => {
  const query = `
    SELECT id, signup_id, hours, status, recorded_by, created_at, updated_at
    FROM volunteer_hours
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Retrieve all volunteer hours for a specific volunteer across all their signups
 * @param {string} volunteerId - Volunteer UUID
 * @param {Object} [filters] - Optional date filters { from_date, to_date }
 * @returns {Promise<Array>} List of volunteer_hours records with joined details
 */
const findByVolunteerId = async (volunteerId, { from_date, to_date } = {}) => {
  const query = `
    SELECT 
      vh.id,
      vh.signup_id,
      s.opportunity_id,
      o.title AS opportunity_title,
      org.id AS organization_id,
      org.name AS organization_name,
      vh.hours,
      vh.status,
      vh.recorded_by,
      vh.created_at,
      vh.updated_at
    FROM volunteer_hours vh
    JOIN signups s ON vh.signup_id = s.id
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE s.volunteer_id = $1
      AND ($2::text IS NULL OR vh.created_at >= ($2 || ' 00:00:00Z')::timestamptz)
      AND ($3::text IS NULL OR vh.created_at < (($3 || ' 00:00:00Z')::timestamptz + INTERVAL '1 day'))
    ORDER BY vh.created_at DESC
  `;
  const values = [volunteerId, from_date || null, to_date || null];
  const { rows } = await pool.query(query, values);
  return rows;
};

/**
 * Retrieve all volunteer hours for opportunities belonging to organizations owned by the coordinator
 * @param {string} coordinatorId - Coordinator UUID
 * @returns {Promise<Array>} List of volunteer_hours records with joined details
 */
const findByCoordinatorId = async (coordinatorId) => {
  const query = `
    SELECT 
      vh.id,
      vh.signup_id,
      s.opportunity_id,
      o.title AS opportunity_title,
      org.id AS organization_id,
      org.name AS organization_name,
      s.volunteer_id,
      u.full_name AS volunteer_name,
      u.email AS volunteer_email,
      vh.hours,
      vh.status,
      vh.recorded_by,
      vh.created_at,
      vh.updated_at
    FROM volunteer_hours vh
    JOIN signups s ON vh.signup_id = s.id
    JOIN users u ON s.volunteer_id = u.id
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE org.coordinator_id = $1
    ORDER BY vh.created_at DESC
  `;
  const { rows } = await pool.query(query, [coordinatorId]);
  return rows;
};

/**
 * Retrieve a volunteer_hours record along with the owning coordinator ID
 * @param {string} id - Volunteer hours UUID
 * @returns {Promise<Object|null>} Record with coordinator_id or null if not found
 */
const findByIdWithCoordinator = async (id) => {
  const query = `
    SELECT 
      vh.id,
      vh.signup_id,
      vh.hours,
      vh.status,
      vh.recorded_by,
      vh.created_at,
      vh.updated_at,
      org.coordinator_id,
      org.id AS organization_id
    FROM volunteer_hours vh
    JOIN signups s ON vh.signup_id = s.id
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE vh.id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Update the status of a volunteer_hours record
 * @param {string} id - Volunteer hours UUID
 * @param {string} status - New status (PENDING, RECORDED, VERIFIED)
 * @returns {Promise<Object>} Updated volunteer_hours record
 */
const updateStatus = async (id, status) => {
  const query = `
    UPDATE volunteer_hours
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, signup_id, hours, status, recorded_by, created_at, updated_at
  `;
  const { rows } = await pool.query(query, [status, id]);
  return rows[0];
};

/**
 * Calculate aggregate volunteer hours summary for a specific volunteer
 * @param {string} volunteerId - Volunteer UUID
 * @returns {Promise<Object>} Aggregated summary
 */
const getSummaryByVolunteerId = async (volunteerId) => {
  const query = `
    SELECT 
      COALESCE(SUM(vh.hours), 0) AS total_hours,
      COUNT(vh.id)::int AS total_records,
      COALESCE(SUM(CASE WHEN vh.status = 'VERIFIED' THEN vh.hours ELSE 0 END), 0) AS verified_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'RECORDED' THEN vh.hours ELSE 0 END), 0) AS recorded_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'PENDING' THEN vh.hours ELSE 0 END), 0) AS pending_hours
    FROM volunteer_hours vh
    JOIN signups s ON vh.signup_id = s.id
    WHERE s.volunteer_id = $1
  `;
  const { rows } = await pool.query(query, [volunteerId]);
  const row = rows[0] || {};
  return {
    total_hours: parseFloat(Number(row.total_hours || 0).toFixed(2)),
    total_records: parseInt(row.total_records || 0, 10),
    verified_hours: parseFloat(Number(row.verified_hours || 0).toFixed(2)),
    recorded_hours: parseFloat(Number(row.recorded_hours || 0).toFixed(2)),
    pending_hours: parseFloat(Number(row.pending_hours || 0).toFixed(2)),
  };
};

/**
 * Calculate aggregate volunteer hours summary for organizations owned by a coordinator
 * @param {string} coordinatorId - Coordinator UUID
 * @returns {Promise<Object>} Aggregated summary
 */
const getSummaryByCoordinatorId = async (coordinatorId) => {
  const query = `
    SELECT 
      COALESCE(SUM(vh.hours), 0) AS total_hours,
      COUNT(vh.id)::int AS total_records,
      COALESCE(SUM(CASE WHEN vh.status = 'VERIFIED' THEN vh.hours ELSE 0 END), 0) AS verified_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'RECORDED' THEN vh.hours ELSE 0 END), 0) AS recorded_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'PENDING' THEN vh.hours ELSE 0 END), 0) AS pending_hours,
      COUNT(DISTINCT s.volunteer_id)::int AS total_volunteers
    FROM volunteer_hours vh
    JOIN signups s ON vh.signup_id = s.id
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE org.coordinator_id = $1
  `;
  const { rows } = await pool.query(query, [coordinatorId]);
  const row = rows[0] || {};
  return {
    total_hours: parseFloat(Number(row.total_hours || 0).toFixed(2)),
    total_records: parseInt(row.total_records || 0, 10),
    verified_hours: parseFloat(Number(row.verified_hours || 0).toFixed(2)),
    recorded_hours: parseFloat(Number(row.recorded_hours || 0).toFixed(2)),
    pending_hours: parseFloat(Number(row.pending_hours || 0).toFixed(2)),
    total_volunteers: parseInt(row.total_volunteers || 0, 10),
  };
};

/**
 * Calculate aggregate volunteer hours summary per opportunity for organizations owned by a coordinator
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [filters] - Optional date filters { from_date, to_date }
 * @returns {Promise<Array>} List of opportunity summaries
 */
const getOpportunitySummaryByCoordinatorId = async (coordinatorId, { from_date, to_date } = {}) => {
  const query = `
    SELECT 
      o.id AS opportunity_id,
      o.title AS opportunity_title,
      org.id AS organization_id,
      org.name AS organization_name,
      COUNT(DISTINCT CASE WHEN vh.id IS NOT NULL THEN s.volunteer_id ELSE NULL END)::int AS total_volunteers,
      COALESCE(SUM(vh.hours), 0) AS total_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'VERIFIED' THEN vh.hours ELSE 0 END), 0) AS verified_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'RECORDED' THEN vh.hours ELSE 0 END), 0) AS recorded_hours,
      COALESCE(SUM(CASE WHEN vh.status = 'PENDING' THEN vh.hours ELSE 0 END), 0) AS pending_hours
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN signups s ON s.opportunity_id = o.id
    LEFT JOIN volunteer_hours vh 
      ON vh.signup_id = s.id
      AND ($2::text IS NULL OR vh.created_at >= ($2 || ' 00:00:00Z')::timestamptz)
      AND ($3::text IS NULL OR vh.created_at < (($3 || ' 00:00:00Z')::timestamptz + INTERVAL '1 day'))
    WHERE org.coordinator_id = $1
    GROUP BY o.id, o.title, org.id, org.name, o.created_at
    ORDER BY o.created_at DESC, o.id DESC
  `;
  const values = [coordinatorId, from_date || null, to_date || null];
  const { rows } = await pool.query(query, values);
  return rows.map((row) => ({
    opportunity_id: row.opportunity_id,
    opportunity_title: row.opportunity_title,
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    total_volunteers: parseInt(row.total_volunteers || 0, 10),
    total_hours: parseFloat(Number(row.total_hours || 0).toFixed(2)),
    verified_hours: parseFloat(Number(row.verified_hours || 0).toFixed(2)),
    recorded_hours: parseFloat(Number(row.recorded_hours || 0).toFixed(2)),
    pending_hours: parseFloat(Number(row.pending_hours || 0).toFixed(2)),
  }));
};


module.exports = {
  create,
  findBySignupId,
  findById,
  findByVolunteerId,
  findByCoordinatorId,
  findByIdWithCoordinator,
  updateStatus,
  getSummaryByVolunteerId,
  getSummaryByCoordinatorId,
  getOpportunitySummaryByCoordinatorId,
};




