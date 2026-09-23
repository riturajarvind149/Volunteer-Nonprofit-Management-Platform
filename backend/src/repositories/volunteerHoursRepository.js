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

module.exports = {
  create,
  findBySignupId,
  findById,
};
