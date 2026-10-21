const notificationService = require('../services/notificationService');

/**
 * Controller for notifications management.
 */

/**
 * Get notifications for authenticated user
 * GET /api/notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit || 50, 10);

    const result = await notificationService.getUserNotifications(userId, {
      unreadOnly,
      limit,
    });

    res.status(200).json({
      status: 'success',
      message: 'Notifications retrieved successfully',
      data: {
        notifications: result.notifications,
        unread_count: result.unread_count,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await notificationService.markNotificationAsRead(id, userId);

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read',
      data: {
        notification,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await notificationService.markAllNotificationsAsRead(userId);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
      data: {
        updated_count: result.updated_count,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
