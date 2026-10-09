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
    SELECT id, name, description, coordinator_id, created_at, updated_at
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
    SELECT id, name, description, coordinator_id, created_at, updated_at
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
    SELECT id, name, description, coordinator_id, created_at, updated_at
    FROM organizations
    WHERE id = $1
      AND coordinator_id = $2
  `;
  const { rows } = await pool.query(query, [id, coordinator_id]);
  return rows[0] || null;
};

module.exports = {
  create,
  findAll,
  findById,
  findByIdAndCoordinatorId,
};

