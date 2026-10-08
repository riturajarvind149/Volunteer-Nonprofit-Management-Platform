const pool = require('../config/db');

/**
 * Data-access repository for the opportunities and signups tables.
 * Uses parameterized queries to prevent SQL injection.
 */

/**
 * Insert a new opportunity
 */
const create = async ({
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
}) => {
  const query = `
    INSERT INTO opportunities
      (organization_id, title, description, category, event_date, start_time, end_time, location, address, capacity, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PUBLISHED')
    RETURNING *
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
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieve all PUBLISHED opportunities with volunteer spot counts
 */
const findAll = async () => {
  const query = `
    SELECT
      o.*,
      org.name AS organization_name,
      o.capacity - COUNT(s.id) FILTER (WHERE s.status = 'REGISTERED') AS spots_remaining
    FROM opportunities o
    LEFT JOIN organizations org ON org.id = o.organization_id
    LEFT JOIN signups s ON s.opportunity_id = o.id
    WHERE o.status = 'PUBLISHED'
    GROUP BY o.id, org.name
    ORDER BY o.event_date ASC, o.start_time ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Retrieve a single opportunity by UUID
 */
const findById = async (id) => {
  const query = `
    SELECT
      o.*,
      org.name AS organization_name,
      o.capacity - COUNT(s.id) FILTER (WHERE s.status = 'REGISTERED') AS spots_remaining
    FROM opportunities o
    LEFT JOIN organizations org ON org.id = o.organization_id
    LEFT JOIN signups s ON s.opportunity_id = o.id
    WHERE o.id = $1
    GROUP BY o.id, org.name
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Sign a volunteer up for an opportunity
 */
const createSignup = async ({ volunteer_id, opportunity_id }) => {
  const query = `
    INSERT INTO signups (volunteer_id, opportunity_id, status)
    VALUES ($1, $2, 'REGISTERED')
    RETURNING *
  `;
  const { rows } = await pool.query(query, [volunteer_id, opportunity_id]);
  return rows[0];
};

/**
 * Cancel a volunteer's signup
 */
const deleteSignup = async ({ volunteer_id, opportunity_id }) => {
  const query = `
    DELETE FROM signups
    WHERE volunteer_id = $1 AND opportunity_id = $2
    RETURNING *
  `;
  const { rows } = await pool.query(query, [volunteer_id, opportunity_id]);
  return rows[0] || null;
};

/**
 * Check if a volunteer is already signed up for an opportunity
 */
const findSignup = async ({ volunteer_id, opportunity_id }) => {
  const query = `
    SELECT id FROM signups
    WHERE volunteer_id = $1 AND opportunity_id = $2
  `;
  const { rows } = await pool.query(query, [volunteer_id, opportunity_id]);
  return rows[0] || null;
};

/**
 * Get all opportunities a volunteer is registered for
 */
const findSignedUpByVolunteer = async (volunteer_id) => {
  const query = `
    SELECT
      o.*,
      org.name AS organization_name,
      o.capacity - COUNT(s2.id) FILTER (WHERE s2.status = 'REGISTERED') AS spots_remaining
    FROM signups s
    JOIN opportunities o ON o.id = s.opportunity_id
    LEFT JOIN organizations org ON org.id = o.organization_id
    LEFT JOIN signups s2 ON s2.opportunity_id = o.id
    WHERE s.volunteer_id = $1 AND s.status = 'REGISTERED'
    GROUP BY o.id, org.name
    ORDER BY o.event_date ASC
  `;
  const { rows } = await pool.query(query, [volunteer_id]);
  return rows;
};

/**
 * Get dashboard stats for a volunteer:
 * - upcoming registrations
 * - completed registrations
 * - total verified volunteer hours
 */
const getVolunteerStats = async (volunteer_id) => {
  const query = `
    SELECT
      COUNT(*) FILTER (
        WHERE s.status = 'REGISTERED' AND o.event_date >= CURRENT_DATE
      ) AS upcoming_count,
      COUNT(*) FILTER (
        WHERE o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE
      ) AS completed_count,
      COALESCE(SUM(vh.hours) FILTER (WHERE vh.status = 'VERIFIED'), 0) AS total_hours
    FROM signups s
    JOIN opportunities o ON o.id = s.opportunity_id
    LEFT JOIN volunteer_hours vh ON vh.signup_id = s.id
    WHERE s.volunteer_id = $1
  `;
  const { rows } = await pool.query(query, [volunteer_id]);
  return rows[0];
};

/**
 * Get dashboard stats for a coordinator:
 * - organizations they manage
 * - published opportunities across their orgs
 * - total volunteers registered across their opportunities
 */
const getCoordinatorStats = async (coordinator_id) => {
  const query = `
    SELECT
      COUNT(DISTINCT org.id) AS organizations_count,
      COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'PUBLISHED') AS active_opportunities,
      COUNT(s.id) FILTER (WHERE s.status = 'REGISTERED') AS total_volunteers_registered
    FROM organizations org
    LEFT JOIN opportunities o ON o.organization_id = org.id
    LEFT JOIN signups s ON s.opportunity_id = o.id
    WHERE org.coordinator_id = $1
  `;
  const { rows } = await pool.query(query, [coordinator_id]);
  return rows[0];
};

module.exports = {
  create,
  findAll,
  findById,
  createSignup,
  deleteSignup,
  findSignup,
  findSignedUpByVolunteer,
  getVolunteerStats,
  getCoordinatorStats,
};
