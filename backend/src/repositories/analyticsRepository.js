const pool = require('../config/db');

/**
 * Data-access repository for platform analytics and dashboard aggregations.
 */

/**
 * Retrieve comprehensive analytics for a volunteer.
 * @param {string} volunteerId - Volunteer UUID
 * @returns {Promise<Object>} Aggregated metrics, upcoming event, activity, and monthly trend
 */
const getVolunteerAnalytics = async (volunteerId) => {
  // 1. Core Summary Metrics
  const summaryQuery = `
    SELECT
      (SELECT COALESCE(SUM(vh.hours), 0)
       FROM volunteer_hours vh
       JOIN signups s ON vh.signup_id = s.id
       WHERE s.volunteer_id = $1
      ) AS total_hours,
      (SELECT COALESCE(SUM(vh.hours), 0)
       FROM volunteer_hours vh
       JOIN signups s ON vh.signup_id = s.id
       WHERE s.volunteer_id = $1 AND vh.status = 'VERIFIED'
      ) AS verified_hours,
      (SELECT COUNT(DISTINCT s.opportunity_id)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       WHERE s.volunteer_id = $1
         AND s.status = 'REGISTERED'
         AND (o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE)
      ) AS completed_events,
      (SELECT COUNT(DISTINCT s.opportunity_id)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       WHERE s.volunteer_id = $1
         AND s.status = 'REGISTERED'
         AND o.status = 'PUBLISHED'
         AND o.event_date >= CURRENT_DATE
      ) AS upcoming_events,
      (SELECT COUNT(DISTINCT o.organization_id)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       WHERE s.volunteer_id = $1 AND s.status = 'REGISTERED'
      ) AS organizations_supported
  `;
  const summaryRes = await pool.query(summaryQuery, [volunteerId]);
  const summary = summaryRes.rows[0] || {};

  // 2. Next Upcoming Event
  const nextEventQuery = `
    SELECT
      o.id,
      o.title,
      o.category,
      o.event_date,
      o.start_time,
      o.end_time,
      o.location,
      o.address,
      org.id AS organization_id,
      org.name AS organization_name
    FROM signups s
    JOIN opportunities o ON s.opportunity_id = o.id
    JOIN organizations org ON o.organization_id = org.id
    WHERE s.volunteer_id = $1
      AND s.status = 'REGISTERED'
      AND o.status = 'PUBLISHED'
      AND o.event_date >= CURRENT_DATE
    ORDER BY o.event_date ASC, o.start_time ASC
    LIMIT 1
  `;
  const nextEventRes = await pool.query(nextEventQuery, [volunteerId]);
  const nextUpcomingEvent = nextEventRes.rows[0] || null;

  // 3. Monthly Hours (last 6 calendar months)
  const monthlyHoursQuery = `
    WITH months AS (
      SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_date
    )
    SELECT
      TO_CHAR(m.month_date, 'Mon') AS month,
      DATE_PART('year', m.month_date)::int AS year,
      COALESCE(SUM(vh.hours), 0)::numeric(6,2) AS hours
    FROM months m
    LEFT JOIN signups s ON s.volunteer_id = $1
    LEFT JOIN volunteer_hours vh
      ON vh.signup_id = s.id
      AND DATE_TRUNC('month', vh.created_at) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date ASC
  `;
  const monthlyHoursRes = await pool.query(monthlyHoursQuery, [volunteerId]);

  // 4. Recent Activity (Recent signups & hours logged)
  const activityQuery = `
    (
      SELECT
        'SIGNUP' AS activity_type,
        'Registered for ' || o.title AS description,
        o.title AS opportunity_title,
        org.name AS organization_name,
        s.created_at AS timestamp
      FROM signups s
      JOIN opportunities o ON s.opportunity_id = o.id
      JOIN organizations org ON o.organization_id = org.id
      WHERE s.volunteer_id = $1
      ORDER BY s.created_at DESC
      LIMIT 5
    )
    UNION ALL
    (
      SELECT
        'HOURS' AS activity_type,
        CASE
          WHEN vh.status = 'VERIFIED' THEN vh.hours || ' hours verified for ' || o.title
          ELSE vh.hours || ' hours logged for ' || o.title
        END AS description,
        o.title AS opportunity_title,
        org.name AS organization_name,
        vh.updated_at AS timestamp
      FROM volunteer_hours vh
      JOIN signups s ON vh.signup_id = s.id
      JOIN opportunities o ON s.opportunity_id = o.id
      JOIN organizations org ON o.organization_id = org.id
      WHERE s.volunteer_id = $1
      ORDER BY vh.updated_at DESC
      LIMIT 5
    )
    ORDER BY timestamp DESC
    LIMIT 6
  `;
  const activityRes = await pool.query(activityQuery, [volunteerId]);

  // 5. Volunteering Streak (Consecutive weeks with volunteer activity)
  const streakQuery = `
    WITH active_weeks AS (
      SELECT DISTINCT DATE_PART('week', created_at) AS week_num, DATE_PART('year', created_at) AS year_num
      FROM (
        SELECT created_at FROM signups WHERE volunteer_id = $1 AND status = 'REGISTERED'
        UNION ALL
        SELECT vh.created_at FROM volunteer_hours vh JOIN signups s ON vh.signup_id = s.id WHERE s.volunteer_id = $1
      ) combined
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 weeks'
    )
    SELECT COUNT(*)::int AS streak_weeks FROM active_weeks
  `;
  const streakRes = await pool.query(streakQuery, [volunteerId]);
  const streakWeeks = streakRes.rows[0]?.streak_weeks || 0;

  return {
    metrics: {
      total_hours: parseFloat(Number(summary.total_hours || 0).toFixed(2)),
      verified_hours: parseFloat(Number(summary.verified_hours || 0).toFixed(2)),
      completed_events: parseInt(summary.completed_events || 0, 10),
      upcoming_events: parseInt(summary.upcoming_events || 0, 10),
      organizations_supported: parseInt(summary.organizations_supported || 0, 10),
      streak_weeks: streakWeeks,
    },
    next_upcoming_event: nextUpcomingEvent,
    hours_by_month: monthlyHoursRes.rows.map((r) => ({
      month: r.month,
      year: r.year,
      hours: parseFloat(Number(r.hours || 0).toFixed(2)),
    })),
    recent_activity: activityRes.rows,
  };
};

/**
 * Retrieve comprehensive analytics for a coordinator across their organizations.
 * @param {string} coordinatorId - Coordinator UUID
 * @param {Object} [options] - Options (e.g., period filter)
 * @returns {Promise<Object>} Aggregated coordinator metrics and analytical breakdowns
 */
const getCoordinatorAnalytics = async (coordinatorId, { period = 'all' } = {}) => {
  // 1. High-level Summary Metrics
  const summaryQuery = `
    SELECT
      (SELECT COUNT(DISTINCT s.volunteer_id)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1 AND s.status = 'REGISTERED'
      ) AS total_volunteers,
      (SELECT COUNT(DISTINCT s.volunteer_id)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND s.status = 'REGISTERED'
         AND s.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ) AS volunteers_this_month,
      (SELECT COUNT(o.id)::int
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1 AND o.status = 'PUBLISHED'
      ) AS active_opportunities,
      (SELECT COUNT(o.id)::int
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND o.status = 'PUBLISHED'
         AND o.event_date >= CURRENT_DATE
      ) AS upcoming_events,
      (SELECT COALESCE(SUM(vh.hours), 0)
       FROM volunteer_hours vh
       JOIN signups s ON vh.signup_id = s.id
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
      ) AS total_hours,
      (SELECT COALESCE(SUM(vh.hours), 0)
       FROM volunteer_hours vh
       JOIN signups s ON vh.signup_id = s.id
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND vh.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ) AS hours_this_month,
      (SELECT COUNT(o.id)::int
       FROM opportunities o
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND (o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE)
      ) AS completed_events,
      (SELECT COUNT(s.id)::int
       FROM signups s
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1
         AND s.status = 'REGISTERED'
         AND s.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ) AS registrations_this_month,
      (SELECT COUNT(vh.id)::int
       FROM volunteer_hours vh
       JOIN signups s ON vh.signup_id = s.id
       JOIN opportunities o ON s.opportunity_id = o.id
       JOIN organizations org ON o.organization_id = org.id
       WHERE org.coordinator_id = $1 AND vh.status = 'PENDING'
      ) AS pending_hours_count
  `;
  const summaryRes = await pool.query(summaryQuery, [coordinatorId]);
  const summary = summaryRes.rows[0] || {};

  // Calculate average volunteers per opportunity
  const avgQuery = `
    SELECT
      COALESCE(AVG(active_count), 0)::numeric(5,1) AS avg_volunteers_per_event
    FROM (
      SELECT COUNT(s.id) AS active_count
      FROM opportunities o
      JOIN organizations org ON o.organization_id = org.id
      LEFT JOIN signups s ON o.id = s.opportunity_id AND s.status = 'REGISTERED'
      WHERE org.coordinator_id = $1
      GROUP BY o.id
    ) counts
  `;
  const avgRes = await pool.query(avgQuery, [coordinatorId]);
  const avgVolunteersPerEvent = parseFloat(avgRes.rows[0]?.avg_volunteers_per_event || 0);

  // 2. Monthly Volunteer Hours Trend (past 6 months)
  const monthlyHoursQuery = `
    WITH months AS (
      SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_date
    )
    SELECT
      TO_CHAR(m.month_date, 'Mon') AS month,
      DATE_PART('year', m.month_date)::int AS year,
      COALESCE(SUM(vh.hours), 0)::numeric(6,2) AS hours
    FROM months m
    LEFT JOIN organizations org ON org.coordinator_id = $1
    LEFT JOIN opportunities o ON o.organization_id = org.id
    LEFT JOIN signups s ON s.opportunity_id = o.id
    LEFT JOIN volunteer_hours vh
      ON vh.signup_id = s.id
      AND DATE_TRUNC('month', vh.created_at) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date ASC
  `;
  const monthlyHoursRes = await pool.query(monthlyHoursQuery, [coordinatorId]);

  // 3. Monthly Registrations Trend (past 6 months)
  const monthlyRegsQuery = `
    WITH months AS (
      SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
        DATE_TRUNC('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS month_date
    )
    SELECT
      TO_CHAR(m.month_date, 'Mon') AS month,
      DATE_PART('year', m.month_date)::int AS year,
      COUNT(s.id)::int AS registrations
    FROM months m
    LEFT JOIN organizations org ON org.coordinator_id = $1
    LEFT JOIN opportunities o ON o.organization_id = org.id
    LEFT JOIN signups s
      ON s.opportunity_id = o.id
      AND s.status = 'REGISTERED'
      AND DATE_TRUNC('month', s.created_at) = m.month_date
    GROUP BY m.month_date
    ORDER BY m.month_date ASC
  `;
  const monthlyRegsRes = await pool.query(monthlyRegsQuery, [coordinatorId]);

  // 4. Volunteers per Opportunity (Top opportunities with fill rate)
  const oppsQuery = `
    SELECT
      o.id,
      o.title,
      o.category,
      o.capacity,
      COUNT(s.id)::int AS registered_count,
      ROUND((COUNT(s.id)::numeric / NULLIF(o.capacity, 0)) * 100, 1)::numeric(5,1) AS fill_rate_percentage
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN signups s ON o.id = s.opportunity_id AND s.status = 'REGISTERED'
    WHERE org.coordinator_id = $1
    GROUP BY o.id, o.title, o.category, o.capacity
    ORDER BY registered_count DESC
    LIMIT 6
  `;
  const oppsRes = await pool.query(oppsQuery, [coordinatorId]);

  // 5. Category Breakdown
  const categoryQuery = `
    SELECT
      COALESCE(o.category, 'General') AS category,
      COUNT(DISTINCT o.id)::int AS opportunity_count,
      COUNT(s.id)::int AS registration_count
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    LEFT JOIN signups s ON o.id = s.opportunity_id AND s.status = 'REGISTERED'
    WHERE org.coordinator_id = $1
    GROUP BY COALESCE(o.category, 'General')
    ORDER BY registration_count DESC
  `;
  const categoryRes = await pool.query(categoryQuery, [coordinatorId]);

  // 6. Event Status Distribution
  const statusQuery = `
    SELECT
      COUNT(CASE WHEN o.status = 'COMPLETED' OR o.event_date < CURRENT_DATE THEN 1 END)::int AS completed,
      COUNT(CASE WHEN o.status = 'PUBLISHED' AND o.event_date >= CURRENT_DATE THEN 1 END)::int AS upcoming,
      COUNT(CASE WHEN o.status = 'DRAFT' THEN 1 END)::int AS draft,
      COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END)::int AS cancelled
    FROM opportunities o
    JOIN organizations org ON o.organization_id = org.id
    WHERE org.coordinator_id = $1
  `;
  const statusRes = await pool.query(statusQuery, [coordinatorId]);
  const eventStatus = statusRes.rows[0] || {};

  return {
    metrics: {
      total_volunteers: parseInt(summary.total_volunteers || 0, 10),
      volunteers_this_month: parseInt(summary.volunteers_this_month || 0, 10),
      active_opportunities: parseInt(summary.active_opportunities || 0, 10),
      upcoming_events: parseInt(summary.upcoming_events || 0, 10),
      total_hours: parseFloat(Number(summary.total_hours || 0).toFixed(2)),
      hours_this_month: parseFloat(Number(summary.hours_this_month || 0).toFixed(2)),
      completed_events: parseInt(summary.completed_events || 0, 10),
      registrations_this_month: parseInt(summary.registrations_this_month || 0, 10),
      avg_volunteers_per_event: avgVolunteersPerEvent,
      pending_hours_count: parseInt(summary.pending_hours_count || 0, 10),
    },
    hours_by_month: monthlyHoursRes.rows.map((r) => ({
      month: r.month,
      year: r.year,
      hours: parseFloat(Number(r.hours || 0).toFixed(2)),
    })),
    registrations_by_month: monthlyRegsRes.rows,
    volunteers_per_opportunity: oppsRes.rows.map((r) => ({
      ...r,
      fill_rate_percentage: parseFloat(Number(r.fill_rate_percentage || 0).toFixed(1)),
    })),
    category_breakdown: categoryRes.rows,
    event_status_distribution: {
      completed: parseInt(eventStatus.completed || 0, 10),
      upcoming: parseInt(eventStatus.upcoming || 0, 10),
      draft: parseInt(eventStatus.draft || 0, 10),
      cancelled: parseInt(eventStatus.cancelled || 0, 10),
    },
  };
};

module.exports = {
  getVolunteerAnalytics,
  getCoordinatorAnalytics,
};
