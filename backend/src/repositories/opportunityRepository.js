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
    SELECT o.id, o.organization_id, o.title, o.description, o.category, o.event_date,
           o.start_time, o.end_time, o.location, o.address, o.capacity, o.status,
           o.created_at, o.updated_at,
           org.name AS organization_name,
           org.coordinator_id,
           (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED') AS active_signups,
           (o.capacity - (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED')) AS spots_remaining
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    ORDER BY o.event_date ASC, o.start_time ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

/**
 * Retrieve all opportunities managed by a specific coordinator
 * @param {string} coordinatorId - Coordinator user UUID
 * @returns {Promise<Array>} List of coordinator's opportunities
 */
const findOpportunitiesByCoordinatorId = async (coordinatorId) => {
  const query = `
    SELECT o.id, o.organization_id, o.title, o.description, o.category, o.event_date,
           o.start_time, o.end_time, o.location, o.address, o.capacity, o.status,
           o.created_at, o.updated_at,
           org.name AS organization_name,
           org.coordinator_id,
           (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED') AS active_signups,
           (o.capacity - (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED')) AS spots_remaining
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    WHERE org.coordinator_id = $1
    ORDER BY o.event_date ASC, o.start_time ASC
  `;
  const { rows } = await pool.query(query, [coordinatorId]);
  return rows;
};

/**
 * Retrieve a single opportunity by its UUID
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object|null>} Opportunity record or null if not found
 */
const findOpportunityById = async (id) => {
  const query = `
    SELECT o.id, o.organization_id, o.title, o.description, o.category, o.event_date,
           o.start_time, o.end_time, o.location, o.address, o.capacity, o.status,
           o.created_at, o.updated_at,
           org.name AS organization_name,
           org.coordinator_id,
           (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED') AS active_signups,
           (o.capacity - (SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED')) AS spots_remaining
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    WHERE o.id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Retrieve a single opportunity along with its organization's coordinator_id
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object|null>} Opportunity record with coordinator_id or null
 */
const findOpportunityByIdWithCoordinator = async (id) => {
  const query = `
    SELECT o.id, o.organization_id, o.title, o.description, o.category, o.event_date,
           o.start_time, o.end_time, o.location, o.address, o.capacity, o.status,
           o.created_at, o.updated_at,
           org.coordinator_id
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    WHERE o.id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Update an existing opportunity record with provided partial fields
 * @param {string} id - Opportunity UUID
 * @param {Object} updateFields - Fields to update
 * @returns {Promise<Object|null>} Updated opportunity record
 */
const updateOpportunity = async (id, updateFields) => {
  const allowedKeys = [
    'title',
    'description',
    'category',
    'event_date',
    'start_time',
    'end_time',
    'location',
    'address',
    'capacity',
    'status',
  ];

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

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id);
  const query = `
    UPDATE opportunities
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, organization_id, title, description, category, event_date,
              start_time, end_time, location, address, capacity, status,
              created_at, updated_at
  `;

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

/**
 * Retrieve live dashboard statistics for a volunteer
 * @param {string} volunteerId - Volunteer user UUID
 * @returns {Promise<Object>} Volunteer stats: upcoming_count, completed_count, total_hours
 */
const getVolunteerStats = async (volunteerId) => {
  const query = `
    SELECT
      (SELECT COUNT(*)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       WHERE s.volunteer_id = $1
         AND s.status = 'REGISTERED'
         AND o.status != 'CANCELLED'
         AND o.event_date >= CURRENT_DATE
      ) AS upcoming_count,
      (SELECT COUNT(*)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       WHERE s.volunteer_id = $1
         AND s.status = 'REGISTERED'
         AND o.status != 'CANCELLED'
         AND (o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE)
      ) AS completed_count,
      (SELECT COALESCE(SUM(vh.hours), 0)
       FROM volunteer_hours vh
       JOIN signups s ON vh.signup_id = s.id
       WHERE s.volunteer_id = $1
         AND vh.status = 'VERIFIED'
      ) AS total_hours
  `;
  const { rows } = await pool.query(query, [volunteerId]);
  const row = rows[0] || {};
  return {
    upcoming_count: parseInt(row.upcoming_count || 0, 10),
    completed_count: parseInt(row.completed_count || 0, 10),
    total_hours: parseFloat(Number(row.total_hours || 0).toFixed(2)),
  };
};

/**
 * Retrieve live dashboard statistics for a coordinator
 * @param {string} coordinatorId - Coordinator user UUID
 * @returns {Promise<Object>} Coordinator stats: organizations_count, active_opportunities, total_volunteers_registered
 */
const getCoordinatorStats = async (coordinatorId) => {
  const query = `
    SELECT
      (SELECT COUNT(*)::int
       FROM organizations
       WHERE coordinator_id = $1
      ) AS organizations_count,
      (SELECT COUNT(*)::int
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND o.status = 'PUBLISHED'
      ) AS active_opportunities,
      (SELECT COUNT(*)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND s.status = 'REGISTERED'
      ) AS total_volunteers_registered
  `;
  const { rows } = await pool.query(query, [coordinatorId]);
  const row = rows[0] || {};
  return {
    organizations_count: parseInt(row.organizations_count || 0, 10),
    active_opportunities: parseInt(row.active_opportunities || 0, 10),
    total_volunteers_registered: parseInt(row.total_volunteers_registered || 0, 10),
  };
};

module.exports = {
  createOpportunity,
  findAllOpportunities,
  findOpportunitiesByCoordinatorId,
  findOpportunityById,
  findOpportunityByIdWithCoordinator,
  updateOpportunity,
  getVolunteerStats,
  getCoordinatorStats,
};
