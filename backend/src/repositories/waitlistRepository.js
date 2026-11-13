const pool = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * Join the waitlist. Only allowed when the opportunity is published and full,
 * and the volunteer has no active signup. The opportunity row is locked so the
 * "is it full?" check is consistent with concurrent signups.
 */
const join = async (opportunityId, volunteerId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const opp = (
      await client.query(
        `SELECT o.id, o.capacity, o.status, org.verification_status
           FROM opportunities o JOIN organizations org ON org.id = o.organization_id
          WHERE o.id = $1 FOR UPDATE OF o`,
        [opportunityId]
      )
    ).rows[0];
    if (!opp) throw new AppError('Opportunity not found', 404);
    if (opp.status !== 'PUBLISHED') throw new AppError('This opportunity is not open for registration', 400);

    const existing = (
      await client.query(
        "SELECT 1 FROM signups WHERE opportunity_id = $1 AND volunteer_id = $2 AND status != 'CANCELLED'",
        [opportunityId, volunteerId]
      )
    ).rows[0];
    if (existing) throw new AppError('You are already registered for this opportunity', 409);

    const active = (
      await client.query(
        "SELECT COUNT(*)::int AS n FROM signups WHERE opportunity_id = $1 AND status != 'CANCELLED'",
        [opportunityId]
      )
    ).rows[0].n;
    if (active < opp.capacity) {
      throw new AppError('Spots are still available — sign up directly instead of joining the waitlist', 409, 'SPOTS_AVAILABLE');
    }

    const { rows } = await client.query(
      `INSERT INTO waitlist_entries (opportunity_id, volunteer_id) VALUES ($1, $2)
       RETURNING id, opportunity_id, volunteer_id, created_at`,
      [opportunityId, volunteerId]
    );
    // Compare inside SQL (JS Dates drop microseconds, which would exclude the new row).
    const position = (
      await client.query(
        `SELECT COUNT(*)::int AS n FROM waitlist_entries w
          WHERE w.opportunity_id = $1
            AND (w.created_at, w.id) <= (SELECT created_at, id FROM waitlist_entries WHERE id = $2)`,
        [opportunityId, rows[0].id]
      )
    ).rows[0].n;
    await client.query('COMMIT');
    return { ...rows[0], position };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const leave = async (opportunityId, volunteerId) => {
  const { rowCount } = await pool.query(
    'DELETE FROM waitlist_entries WHERE opportunity_id = $1 AND volunteer_id = $2',
    [opportunityId, volunteerId]
  );
  return rowCount > 0;
};

/** Position (1-based) of a volunteer on an opportunity's waitlist, or null. */
const getPosition = async (opportunityId, volunteerId) => {
  const { rows } = await pool.query(
    `SELECT position FROM (
       SELECT volunteer_id, ROW_NUMBER() OVER (ORDER BY created_at, id)::int AS position
         FROM waitlist_entries WHERE opportunity_id = $1
     ) ranked WHERE volunteer_id = $2`,
    [opportunityId, volunteerId]
  );
  return rows[0]?.position ?? null;
};

/** All waitlist entries for a volunteer with opportunity info and position. */
const findByVolunteer = async (volunteerId) => {
  const { rows } = await pool.query(
    `SELECT w.id, w.opportunity_id, w.created_at,
            o.title AS opportunity_title, o.event_date AS opportunity_event_date,
            o.start_time AS opportunity_start_time, o.end_time AS opportunity_end_time,
            o.location AS opportunity_location, o.status AS opportunity_status,
            org.name AS organization_name,
            (SELECT COUNT(*)::int FROM waitlist_entries w2
              WHERE w2.opportunity_id = w.opportunity_id
                AND (w2.created_at, w2.id) <= (w.created_at, w.id)) AS position
       FROM waitlist_entries w
       JOIN opportunities o ON o.id = w.opportunity_id
       JOIN organizations org ON org.id = o.organization_id
      WHERE w.volunteer_id = $1
      ORDER BY o.event_date ASC`,
    [volunteerId]
  );
  return rows;
};

/** Waitlist for an opportunity (coordinator view). */
const findByOpportunity = async (opportunityId) => {
  const { rows } = await pool.query(
    `SELECT w.id, w.volunteer_id, w.created_at, u.full_name AS volunteer_name, u.email AS volunteer_email,
            ROW_NUMBER() OVER (ORDER BY w.created_at, w.id)::int AS position
       FROM waitlist_entries w JOIN users u ON u.id = w.volunteer_id
      WHERE w.opportunity_id = $1
      ORDER BY w.created_at, w.id`,
    [opportunityId]
  );
  return rows;
};

/**
 * Move volunteers from the waitlist into free spots (FIFO), atomically.
 * @returns {Promise<Array<{volunteer_id: string, signup_id: string}>>} promoted volunteers
 */
const promote = async (opportunityId) => {
  const client = await pool.connect();
  const promoted = [];
  try {
    await client.query('BEGIN');
    const opp = (
      await client.query(
        'SELECT id, capacity, status, (event_date >= CURRENT_DATE) AS upcoming FROM opportunities WHERE id = $1 FOR UPDATE',
        [opportunityId]
      )
    ).rows[0];
    if (!opp || opp.status !== 'PUBLISHED' || !opp.upcoming) {
      await client.query('COMMIT');
      return promoted;
    }

    let active = (
      await client.query(
        "SELECT COUNT(*)::int AS n FROM signups WHERE opportunity_id = $1 AND status != 'CANCELLED'",
        [opportunityId]
      )
    ).rows[0].n;

    while (active < opp.capacity) {
      const next = (
        await client.query(
          `SELECT id, volunteer_id FROM waitlist_entries
            WHERE opportunity_id = $1 ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [opportunityId]
        )
      ).rows[0];
      if (!next) break;

      const signup = (
        await client.query(
          `INSERT INTO signups (volunteer_id, opportunity_id, status)
           VALUES ($1, $2, 'REGISTERED')
           ON CONFLICT (volunteer_id, opportunity_id)
           DO UPDATE SET status = 'REGISTERED', updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [next.volunteer_id, opportunityId]
        )
      ).rows[0];
      await client.query('DELETE FROM waitlist_entries WHERE id = $1', [next.id]);
      promoted.push({ volunteer_id: next.volunteer_id, signup_id: signup.id });
      active += 1;
    }

    await client.query('COMMIT');
    return promoted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/** Remove a volunteer from the waitlist once they hold a signup. */
const removeIfPresent = async (opportunityId, volunteerId) => leave(opportunityId, volunteerId);

module.exports = {
  join,
  leave,
  getPosition,
  findByVolunteer,
  findByOpportunity,
  promote,
  removeIfPresent,
};
