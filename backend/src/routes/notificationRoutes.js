const express = require('express');
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for authenticated user
 * @access  Protected
 */
router.get('/', authenticate, notificationController.getNotifications);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read for authenticated user
 * @access  Protected
 */
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Protected
 */
router.patch('/:id/read', authenticate, notificationController.markAsRead);

module.exports = router;
