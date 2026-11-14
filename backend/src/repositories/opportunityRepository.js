const crypto = require('crypto');
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
  skills_required,
}) => {
  const checkInCode = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
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
      status,
      skills_required,
      check_in_code
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id, organization_id, title, description, category, event_date,
              start_time, end_time, location, address, capacity, status,
              skills_required, check_in_code, cancellation_reason, created_at, updated_at
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
    skills_required || null,
    checkInCode,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

const ACTIVE_COUNT_SQL =
  "(SELECT COUNT(*)::int FROM signups s WHERE s.opportunity_id = o.id AND s.status != 'CANCELLED')";

/** Public opportunity columns (check_in_code deliberately excluded). */
const OPP_SELECT = `
  o.id, o.organization_id, o.title, o.description, o.category, o.event_date,
  o.start_time, o.end_time, o.location, o.address, o.capacity, o.status,
  o.skills_required, o.cancellation_reason, o.created_at, o.updated_at,
  org.name AS organization_name,
  org.logo_url AS organization_logo_url,
  org.verification_status AS organization_verification_status,
  org.coordinator_id,
  ${ACTIVE_COUNT_SQL} AS active_signups,
  (o.capacity - ${ACTIVE_COUNT_SQL}) AS spots_remaining,
  (SELECT COUNT(*)::int FROM waitlist_entries w WHERE w.opportunity_id = o.id) AS waitlist_count
`;

const SORTS = {
  date: 'o.event_date ASC, o.start_time ASC',
  newest: 'o.created_at DESC',
  spots: 'spots_remaining DESC, o.event_date ASC',
};

/**
 * Search opportunities with visibility rules and filters.
 * @param {Object} f
 * @param {boolean} [f.publicOnly] - only PUBLISHED/COMPLETED from APPROVED orgs
 * @param {string} [f.includeCoordinatorId] - with publicOnly: also include this coordinator's own opportunities
 * @param {string} [f.coordinatorId] - only this coordinator's opportunities
 * @param {string} [f.organization_id]
 * @param {string} [f.q] - text search on title / description / location / organization name
 * @param {string} [f.category]
 * @param {string} [f.location]
 * @param {string} [f.from_date] - YYYY-MM-DD
 * @param {string} [f.to_date] - YYYY-MM-DD
 * @param {boolean} [f.upcoming] - published and event_date >= today
 * @param {boolean} [f.available] - spots remaining > 0
 * @param {string[]} [f.skills] - any overlap with skills_required
 * @param {string} [f.status]
 * @param {string} [f.sort] - date | newest | spots
 * @param {number} [f.limit]
 * @param {number} [f.offset]
 */
const searchOpportunities = async (f = {}) => {
  const values = [];
  const where = [];
  const param = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (f.coordinatorId) {
    where.push(`org.coordinator_id = ${param(f.coordinatorId)}`);
  } else if (f.publicOnly) {
    const visible =
      f.requireApprovedOrg === false
        ? "(o.status IN ('PUBLISHED','COMPLETED') AND org.verification_status NOT IN ('REJECTED','SUSPENDED'))"
        : "(o.status IN ('PUBLISHED','COMPLETED') AND org.verification_status = 'APPROVED')";
    where.push(f.includeCoordinatorId ? `(${visible} OR org.coordinator_id = ${param(f.includeCoordinatorId)})` : visible);
  }
  if (f.organization_id) where.push(`o.organization_id = ${param(f.organization_id)}`);
  if (f.status) where.push(`o.status = ${param(f.status)}`);
  if (f.q) {
    const p = param(`%${f.q}%`);
    where.push(`(o.title ILIKE ${p} OR o.description ILIKE ${p} OR o.location ILIKE ${p} OR org.name ILIKE ${p})`);
  }
  if (f.category) where.push(`LOWER(o.category) = LOWER(${param(f.category)})`);
  if (f.location) {
    const p = param(`%${f.location}%`);
    where.push(`(o.location ILIKE ${p} OR o.address ILIKE ${p})`);
  }
  if (f.from_date) where.push(`o.event_date >= ${param(f.from_date)}::date`);
  if (f.to_date) where.push(`o.event_date <= ${param(f.to_date)}::date`);
  if (f.upcoming) where.push("o.event_date >= CURRENT_DATE AND o.status = 'PUBLISHED'");
  if (f.available) where.push(`(o.capacity - ${ACTIVE_COUNT_SQL}) > 0`);
  if (f.skills && f.skills.length) where.push(`o.skills_required && ${param(f.skills)}::text[]`);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[f.sort] || SORTS.date;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM opportunities o JOIN organizations org ON o.organization_id = org.id ${whereSql}`,
    values
  );

  const pageValues = [...values, f.limit ?? 1000, f.offset ?? 0];
  const { rows } = await pool.query(
    `SELECT ${OPP_SELECT}
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
       ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues
  );

  return { opportunities: rows, total: countResult.rows[0].total };
};

/**
 * Retrieve all opportunities ordered by event date and start time ascending
 */
const findAllOpportunities = async () => (await searchOpportunities({})).opportunities;

/**
 * Registered (non-cancelled) volunteers of an opportunity with contact details.
 */
const findRegisteredVolunteers = async (opportunityId) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.email_notifications, s.id AS signup_id
       FROM signups s
       JOIN users u ON u.id = s.volunteer_id
      WHERE s.opportunity_id = $1 AND s.status = 'REGISTERED'`,
    [opportunityId]
  );
  return rows;
};

/**
 * Published opportunities starting within the reminder window that haven't been reminded yet.
 */
const findDueForReminder = async (timezone, leadHours) => {
  const { rows } = await pool.query(
    `SELECT o.id, o.title, o.event_date, o.start_time, o.end_time, o.location, o.address,
            org.name AS organization_name
       FROM opportunities o
       JOIN organizations org ON org.id = o.organization_id
      WHERE o.status = 'PUBLISHED'
        AND o.reminder_sent_at IS NULL
        AND ((o.event_date + o.start_time) AT TIME ZONE $1) > NOW()
        AND ((o.event_date + o.start_time) AT TIME ZONE $1) <= NOW() + ($2 || ' hours')::interval`,
    [timezone, String(leadHours)]
  );
  return rows;
};

/** Atomically claim an opportunity for reminder sending (prevents duplicates across instances). */
const claimReminder = async (id) => {
  const { rowCount } = await pool.query(
    'UPDATE opportunities SET reminder_sent_at = CURRENT_TIMESTAMP WHERE id = $1 AND reminder_sent_at IS NULL',
    [id]
  );
  return rowCount > 0;
};

/**
 * Retrieve all opportunities managed by a specific coordinator
 * @param {string} coordinatorId - Coordinator user UUID
 * @returns {Promise<Array>} List of coordinator's opportunities
 */
const findOpportunitiesByCoordinatorId = async (coordinatorId) => {
  const { rows } = await pool.query(
    `SELECT ${OPP_SELECT}, o.check_in_code
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
      WHERE org.coordinator_id = $1
      ORDER BY o.event_date ASC, o.start_time ASC`,
    [coordinatorId]
  );
  return rows;
};

/**
 * Retrieve a single opportunity by its UUID
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object|null>} Opportunity record or null if not found
 */
const findOpportunityById = async (id) => {
  // Includes check_in_code — callers must strip it for non-owners.
  const { rows } = await pool.query(
    `SELECT ${OPP_SELECT}, o.check_in_code, o.reminder_sent_at
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
      WHERE o.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Retrieve a single opportunity along with its organization's coordinator_id
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object|null>} Opportunity record with coordinator_id or null
 */
const findOpportunityByIdWithCoordinator = async (id) => findOpportunityById(id);

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
    'skills_required',
    'cancellation_reason',
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

  // A rescheduled event should trigger a fresh reminder.
  if (updateFields.event_date !== undefined || updateFields.start_time !== undefined) {
    setClauses.push('reminder_sent_at = NULL');
  }
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id);
  const query = `
    UPDATE opportunities
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, organization_id, title, description, category, event_date,
              start_time, end_time, location, address, capacity, status,
              skills_required, check_in_code, cancellation_reason, created_at, updated_at
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
      (SELECT COALESCE(SUM(vh.hours) FILTER (WHERE vh.status <> 'REJECTED'), 0)
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

/**
 * Find all PUBLISHED opportunities whose scheduled end time has elapsed
 * @param {string} timezone - Application timezone (e.g. 'Asia/Kolkata')
 * @param {string|Date|null} [simulatedNow] - Optional simulated timestamp for boundary testing
 * @returns {Promise<Array>} List of eligible opportunities
 */
const findEligibleForCompletion = async (timezone, simulatedNow = null) => {
  const query = `
    SELECT 
      id, 
      organization_id, 
      title, 
      description, 
      category, 
      event_date, 
      start_time, 
      end_time, 
      status
    FROM opportunities
    WHERE status = 'PUBLISHED'
      AND (
        (CASE 
          WHEN end_time > start_time THEN (event_date + end_time) 
          ELSE (event_date + INTERVAL '1 day' + end_time) 
        END) AT TIME ZONE $1
      ) <= COALESCE($2::timestamptz, NOW())
    ORDER BY event_date ASC, end_time ASC
  `;
  const values = [timezone, simulatedNow || null];
  const { rows } = await pool.query(query, values);
  return rows;
};

/**
 * Atomically transitions an opportunity from PUBLISHED to COMPLETED.
 * Returns null if status was not PUBLISHED (e.g., already COMPLETED, CANCELLED, or DRAFT).
 * @param {string} id - Opportunity UUID
 * @returns {Promise<Object|null>} Updated opportunity or null if condition unmet
 */
const markCompletedIfPublished = async (id) => {
  const query = `
    UPDATE opportunities
    SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status = 'PUBLISHED'
    RETURNING id, organization_id, title, status, event_date, start_time, end_time, updated_at
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Retrieve registered attendees for an opportunity who have NOT yet received an EVENT_COMPLETED notification.
 * Excludes cancelled signups and volunteers who already received the notification.
 * @param {string} opportunityId - Opportunity UUID
 * @returns {Promise<Array>} List of attendees { volunteer_id, full_name, email }
 */
const findRegisteredAttendeesWithoutCompletionNotification = async (opportunityId) => {
  const query = `
    SELECT 
      s.volunteer_id,
      u.full_name,
      u.email
    FROM signups s
    JOIN users u ON s.volunteer_id = u.id
    WHERE s.opportunity_id = $1
      AND s.status = 'REGISTERED'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = s.volunteer_id
          AND n.reference_id = s.opportunity_id
          AND n.type = 'EVENT_COMPLETED'
      )
  `;
  const { rows } = await pool.query(query, [opportunityId]);
  return rows;
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
  findEligibleForCompletion,
  markCompletedIfPublished,
  findRegisteredAttendeesWithoutCompletionNotification,
  searchOpportunities,
  findRegisteredVolunteers,
  findDueForReminder,
  claimReminder,
};
