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
 * @returns {Promise<Array>} List of volunteer_hours records with joined details
 */
const findByVolunteerId = async (volunteerId) => {
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
    ORDER BY vh.created_at DESC
  `;
  const { rows } = await pool.query(query, [volunteerId]);
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

module.exports = {
  create,
  findBySignupId,
  findById,
  findByVolunteerId,
  findByCoordinatorId,
  findByIdWithCoordinator,
  updateStatus,
};


