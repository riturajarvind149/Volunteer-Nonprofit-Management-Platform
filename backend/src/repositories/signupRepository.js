const pool = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * Data-access repository for signups table.
 * Uses parameterized queries to prevent SQL injection.
 */

/**
 * Concurrency-safe signup creation using transaction and row-level locking.
 * @param {string} opportunityId - Opportunity UUID
 * @param {string} volunteerId - Volunteer user UUID
 * @returns {Promise<Object>} Created signup record
 */
const createSignupTransaction = async (opportunityId, volunteerId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock opportunity row for update to prevent race conditions on capacity
    const oppQuery = `
      SELECT id, title, capacity, status
      FROM opportunities
      WHERE id = $1
      FOR UPDATE
    `;
    const oppResult = await client.query(oppQuery, [opportunityId]);

    if (oppResult.rows.length === 0) {
      throw new AppError('Opportunity not found', 404);
    }

    const opportunity = oppResult.rows[0];

    // 2. Validate opportunity status (Only PUBLISHED opportunities allow signups)
    if (opportunity.status !== 'PUBLISHED') {
      throw new AppError(
        'Cannot sign up for an opportunity that is not published',
        400
      );
    }

    // 3. Check for duplicate signup by this volunteer
    const dupQuery = `
      SELECT id FROM signups
      WHERE volunteer_id = $1 AND opportunity_id = $2
    `;
    const dupResult = await client.query(dupQuery, [volunteerId, opportunityId]);
    if (dupResult.rows.length > 0) {
      throw new AppError(
        'You have already signed up for this opportunity.',
        409
      );
    }

    // 4. Check current signup count against opportunity capacity
    const countQuery = `
      SELECT COUNT(*)::int AS current_count
      FROM signups
      WHERE opportunity_id = $1 AND status != 'CANCELLED'
    `;
    const countResult = await client.query(countQuery, [opportunityId]);
    const currentCount = countResult.rows[0].current_count;

    if (currentCount >= opportunity.capacity) {
      throw new AppError(
        'This opportunity has reached its maximum capacity',
        409
      );
    }

    // 5. Insert signup with status REGISTERED
    const insertQuery = `
      INSERT INTO signups (volunteer_id, opportunity_id, status)
      VALUES ($1, $2, 'REGISTERED')
      RETURNING id, volunteer_id, opportunity_id, status, created_at, updated_at
    `;
    const insertResult = await client.query(insertQuery, [
      volunteerId,
      opportunityId,
    ]);

    await client.query('COMMIT');
    return insertResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    if (
      err.code === '23505' ||
      err.constraint === 'uq_signups_volunteer_opportunity'
    ) {
      throw new AppError(
        'You have already signed up for this opportunity.',
        409
      );
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Retrieve all signups for a volunteer, joined with opportunity details
 * @param {string} volunteerId - Volunteer user UUID
 * @returns {Promise<Array>} List of signup records with opportunity metadata
 */
const findByVolunteerId = async (volunteerId) => {
  const query = `
    SELECT s.id, s.volunteer_id, s.opportunity_id, s.status, s.created_at, s.updated_at,
           o.title AS opportunity_title,
           o.event_date AS opportunity_event_date,
           o.start_time AS opportunity_start_time,
           o.end_time AS opportunity_end_time,
           o.location AS opportunity_location,
           o.organization_id AS opportunity_organization_id
    FROM signups s
    JOIN opportunities o ON s.opportunity_id = o.id
    WHERE s.volunteer_id = $1
    ORDER BY s.created_at DESC
  `;
  const { rows } = await pool.query(query, [volunteerId]);
  return rows;
};

/**
 * Retrieve a single signup by ID joined with opportunity details
 * @param {string} id - Signup UUID
 * @returns {Promise<Object|null>} Signup record or null if not found
 */
const findById = async (id) => {
  const query = `
    SELECT s.id, s.volunteer_id, s.opportunity_id, s.status, s.created_at, s.updated_at,
           o.title AS opportunity_title,
           o.event_date AS opportunity_event_date,
           o.start_time AS opportunity_start_time,
           o.end_time AS opportunity_end_time,
           o.location AS opportunity_location,
           o.organization_id AS opportunity_organization_id
    FROM signups s
    JOIN opportunities o ON s.opportunity_id = o.id
    WHERE s.id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Update the status of a signup record
 * @param {string} id - Signup UUID
 * @param {string} status - New status (e.g. 'CANCELLED')
 * @returns {Promise<Object|null>} Updated signup record or null
 */
const updateStatus = async (id, status) => {
  const query = `
    UPDATE signups
    SET status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, volunteer_id, opportunity_id, status, created_at, updated_at
  `;
  const { rows } = await pool.query(query, [id, status]);
  return rows[0] || null;
};

module.exports = {
  createSignupTransaction,
  findByVolunteerId,
  findById,
  updateStatus,
};
