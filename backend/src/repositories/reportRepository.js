const pool = require('../config/db');

/**
 * Data-access repository for organization reports and exports.
 */

/**
 * Generate volunteer participation report for a coordinator.
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [filters] - { from_date, to_date }
 * @returns {Promise<Array>} List of volunteer participation records
 */
const getVolunteerParticipationReport = async (coordinatorId, { from_date, to_date } = {}) => {
  const query = `
    SELECT
      u.id AS volunteer_id,
      u.full_name AS volunteer_name,
      u.email AS volunteer_email,
      COUNT(DISTINCT s.id)::int AS total_signups,
      COUNT(DISTINCT CASE WHEN s.status = 'REGISTERED' AND (o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE) THEN s.id END)::int AS events_attended,
      COUNT(DISTINCT CASE WHEN s.status = 'CANCELLED' THEN s.id END)::int AS events_cancelled,
      COALESCE(SUM(vh.hours), 0)::numeric(6,2) AS total_hours_logged,
      COALESCE(SUM(CASE WHEN vh.status = 'VERIFIED' THEN vh.hours ELSE 0 END), 0)::numeric(6,2) AS verified_hours,
      MAX(s.created_at) AS last_active_date
    FROM users u
    JOIN signups s ON u.id = s.volunteer_id
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN volunteer_hours vh ON vh.signup_id = s.id
    WHERE org.coordinator_id = $1
      AND ($2::text IS NULL OR s.created_at >= ($2 || ' 00:00:00Z')::timestamptz)
      AND ($3::text IS NULL OR s.created_at < (($3 || ' 00:00:00Z')::timestamptz + INTERVAL '1 day'))
    GROUP BY u.id, u.full_name, u.email
    ORDER BY total_hours_logged DESC, volunteer_name ASC
  `;
  const { rows } = await pool.query(query, [coordinatorId, from_date || null, to_date || null]);
  return rows.map((r) => ({
    ...r,
    total_hours_logged: parseFloat(Number(r.total_hours_logged || 0).toFixed(2)),
    verified_hours: parseFloat(Number(r.verified_hours || 0).toFixed(2)),
  }));
};

/**
 * Generate volunteer hours report for a coordinator.
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [filters] - { from_date, to_date, status }
 * @returns {Promise<Array>} List of volunteer hour log records
 */
const getVolunteerHoursReport = async (coordinatorId, { from_date, to_date, status } = {}) => {
  const query = `
    SELECT
      vh.id AS hour_record_id,
      u.full_name AS volunteer_name,
      u.email AS volunteer_email,
      o.title AS opportunity_title,
      o.category AS opportunity_category,
      org.name AS organization_name,
      vh.hours,
      vh.status,
      vh.created_at AS recorded_at,
      vh.updated_at AS status_updated_at
    FROM volunteer_hours vh
    JOIN signups s ON vh.signup_id = s.id
    JOIN users u ON s.volunteer_id = u.id
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE org.coordinator_id = $1
      AND ($2::text IS NULL OR vh.created_at >= ($2 || ' 00:00:00Z')::timestamptz)
      AND ($3::text IS NULL OR vh.created_at < (($3 || ' 00:00:00Z')::timestamptz + INTERVAL '1 day'))
      AND ($4::text IS NULL OR vh.status = $4)
    ORDER BY vh.created_at DESC
  `;
  const { rows } = await pool.query(query, [
    coordinatorId,
    from_date || null,
    to_date || null,
    status || null,
  ]);
  return rows.map((r) => ({
    ...r,
    hours: parseFloat(Number(r.hours || 0).toFixed(2)),
  }));
};

/**
 * Generate opportunity performance report for a coordinator.
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [filters] - { from_date, to_date }
 * @returns {Promise<Array>} List of opportunity performance records
 */
const getOpportunityPerformanceReport = async (coordinatorId, { from_date, to_date } = {}) => {
  const query = `
    SELECT
      o.id AS opportunity_id,
      o.title,
      o.category,
      o.status,
      o.event_date,
      o.capacity,
      COUNT(DISTINCT CASE WHEN s.status = 'REGISTERED' THEN s.id END)::int AS active_registrations,
      COUNT(DISTINCT CASE WHEN s.status = 'CANCELLED' THEN s.id END)::int AS cancelled_registrations,
      ROUND((COUNT(DISTINCT CASE WHEN s.status = 'REGISTERED' THEN s.id END)::numeric / NULLIF(o.capacity, 0)) * 100, 1)::numeric(5,1) AS fill_rate_percentage,
      COALESCE(SUM(vh.hours), 0)::numeric(6,2) AS total_hours_logged,
      COUNT(DISTINCT vh.id)::int AS hour_entries_count
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN signups s ON o.id = s.opportunity_id
    LEFT JOIN volunteer_hours vh ON s.id = vh.signup_id
    WHERE org.coordinator_id = $1
      AND ($2::text IS NULL OR o.event_date >= $2::date)
      AND ($3::text IS NULL OR o.event_date <= $3::date)
    GROUP BY o.id, o.title, o.category, o.status, o.event_date, o.capacity
    ORDER BY o.event_date DESC, o.title ASC
  `;
  const { rows } = await pool.query(query, [coordinatorId, from_date || null, to_date || null]);
  return rows.map((r) => ({
    ...r,
    fill_rate_percentage: parseFloat(Number(r.fill_rate_percentage || 0).toFixed(1)),
    total_hours_logged: parseFloat(Number(r.total_hours_logged || 0).toFixed(2)),
  }));
};

module.exports = {
  getVolunteerParticipationReport,
  getVolunteerHoursReport,
  getOpportunityPerformanceReport,
};
