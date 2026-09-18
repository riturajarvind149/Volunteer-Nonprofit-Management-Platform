const pool = require('../config/db');

/**
 * Data-access repository for opportunities table.
 * Uses parameterized queries to prevent SQL injection.
 */

/**
 * Insert a new opportunity record
 * @param {Object} oppData
 * @returns {Promise<Object>} Created opportunity record
 */
const createOpportunity = async ({
  organization_id,
  title,
  description,
  category,
  event_date,
  start_time,
  end_time,
  location,
  address,
  capacity,
  status,
}) => {
  const query = `
    INSERT INTO opportunities (
      organization_id,
      title,
      description,
      category,
      event_date,
      start_time,
      end_time,
      location,
      address,
      capacity,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, organization_id, title, description, category, event_date,
              start_time, end_time, location, address, capacity, status,
              created_at, updated_at
  `;

  const values = [
    organization_id,
    title,
    description || null,
    category || null,
    event_date,
    start_time,
    end_time,
    location,
    address || null,
    capacity,
    status || 'DRAFT',
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieve all opportunities ordered by event date and start time ascending
 * @returns {Promise<Array>} List of opportunities
 */
const findAllOpportunities = async () => {
  const query = `
    SELECT id, organization_id, title, description, category, event_date,
           start_time, end_time, location, address, capacity, status,
           created_at, updated_at
    FROM opportunities
    ORDER BY event_date ASC, start_time ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Retrieve a single opportunity by its UUID
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object|null>} Opportunity record or null if not found
 */
const findOpportunityById = async (id) => {
  const query = `
    SELECT id, organization_id, title, description, category, event_date,
           start_time, end_time, location, address, capacity, status,
           created_at, updated_at
    FROM opportunities
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

module.exports = {
  createOpportunity,
  findAllOpportunities,
  findOpportunityById,
};
