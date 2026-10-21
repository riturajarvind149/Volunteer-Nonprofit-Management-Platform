const express = require('express');
const userController = require('../controllers/userController');
const { changePassword } = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile and stats
 * @access  Protected
 */
router.get('/profile', authenticate, userController.getProfile);

/**
 * @route   PATCH /api/users/profile
 * @desc    Update current user profile
 * @access  Protected
 */
router.patch('/profile', authenticate, userController.updateProfile);

/**
 * @route   POST /api/users/change-password
 * @desc    Change current user password
 * @access  Protected
 */
router.post('/change-password', authenticate, changePassword);

module.exports = router;
