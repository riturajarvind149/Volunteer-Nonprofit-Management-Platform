const pool = require('../config/db');

/**
 * Data-access repository for notifications.
 */

/**
 * Insert a new notification
 * @param {Object} data
 * @param {string} data.user_id - User UUID
 * @param {string} data.title - Notification title
 * @param {string} data.message - Notification message
 * @param {string} [data.type] - Notification type (e.g., 'INFO', 'REGISTRATION', 'HOURS')
 * @param {string} [data.reference_id] - Optional reference entity UUID
 * @returns {Promise<Object>} Created notification row
 */
const create = async ({ user_id, title, message, type = 'INFO', reference_id = null }) => {
  const query = `
    INSERT INTO notifications (user_id, title, message, type, is_read, reference_id)
    VALUES ($1, $2, $3, $4, FALSE, $5)
    ON CONFLICT (user_id, reference_id, type) WHERE type = 'EVENT_COMPLETED'
    DO NOTHING
    RETURNING id, user_id, title, message, type, is_read, reference_id, created_at
  `;
  const { rows } = await pool.query(query, [user_id, title, message, type, reference_id]);
  return rows[0] || null;
};

/**
 * Find notifications for a user
 * @param {string} userId - User UUID
 * @param {Object} [options] - { unreadOnly, limit }
 * @returns {Promise<Array>} List of notifications
 */
const findByUserId = async (userId, { unreadOnly = false, limit = 50 } = {}) => {
  let query = `
    SELECT id, user_id, title, message, type, is_read, reference_id, created_at
    FROM notifications
    WHERE user_id = $1
  `;
  const values = [userId];

  if (unreadOnly) {
    query += ` AND is_read = FALSE`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
  values.push(limit);

  const { rows } = await pool.query(query, values);
  return rows;
};

/**
 * Get count of unread notifications for a user
 * @param {string} userId - User UUID
 * @returns {Promise<number>} Unread count
 */
const countUnreadByUserId = async (userId) => {
  const query = `
    SELECT COUNT(*)::int AS unread_count
    FROM notifications
    WHERE user_id = $1 AND is_read = FALSE
  `;
  const { rows } = await pool.query(query, [userId]);
  return rows[0]?.unread_count || 0;
};

/**
 * Mark a single notification as read (verifying user ownership)
 * @param {string} id - Notification UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Updated notification row or null if not found
 */
const markAsRead = async (id, userId) => {
  const query = `
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, title, message, type, is_read, reference_id, created_at
  `;
  const { rows } = await pool.query(query, [id, userId]);
  return rows[0] || null;
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User UUID
 * @returns {Promise<number>} Count of updated rows
 */
const markAllAsRead = async (userId) => {
  const query = `
    UPDATE notifications
    SET is_read = TRUE
    WHERE user_id = $1 AND is_read = FALSE
  `;
  const result = await pool.query(query, [userId]);
  return result.rowCount || 0;
};

module.exports = {
  create,
  findByUserId,
  countUnreadByUserId,
  markAsRead,
  markAllAsRead,
};
