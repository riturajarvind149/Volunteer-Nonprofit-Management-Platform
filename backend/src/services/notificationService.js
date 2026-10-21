const notificationRepository = require('../repositories/notificationRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for in-app notifications.
 */

/**
 * Retrieve notifications for authenticated user
 * @param {string} userId - User UUID
 * @param {Object} [options] - { unreadOnly, limit }
 * @returns {Promise<Object>} { notifications, unread_count }
 */
const getUserNotifications = async (userId, { unreadOnly = false, limit = 50 } = {}) => {
  if (!userId) throw new AppError('User ID is required', 400);

  const [notifications, unreadCount] = await Promise.all([
    notificationRepository.findByUserId(userId, { unreadOnly, limit }),
    notificationRepository.countUnreadByUserId(userId),
  ]);

  return {
    notifications,
    unread_count: unreadCount,
  };
};

/**
 * Mark a single notification as read
 * @param {string} id - Notification UUID
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Updated notification
 */
const markNotificationAsRead = async (id, userId) => {
  if (!id) throw new AppError('Notification ID is required', 400);
  if (!userId) throw new AppError('User ID is required', 400);

  const notification = await notificationRepository.markAsRead(id, userId);
  if (!notification) {
    throw new AppError('Notification not found or unauthorized', 404);
  }

  return notification;
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User UUID
 * @returns {Promise<{ updated_count: number }>}
 */
const markAllNotificationsAsRead = async (userId) => {
  if (!userId) throw new AppError('User ID is required', 400);
  const count = await notificationRepository.markAllAsRead(userId);
  return { updated_count: count };
};

/**
 * Create a new notification (safe helper)
 * @param {Object} data - { user_id, title, message, type, reference_id }
 * @returns {Promise<Object>}
 */
const createNotification = async ({ user_id, title, message, type = 'INFO', reference_id = null }) => {
  if (!user_id || !title || !message) return null;
  try {
    return await notificationRepository.create({
      user_id,
      title,
      message,
      type,
      reference_id,
    });
  } catch (err) {
    // Non-fatal logging if notification creation fails
    console.error('Failed to create notification:', err.message);
    return null;
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
};
