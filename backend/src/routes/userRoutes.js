const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/** GET /api/users/profile — current user profile and stats */
router.get('/profile', authenticate, userController.getProfile);

/** PATCH /api/users/profile — update current user profile */
router.patch('/profile', authenticate, userController.updateProfile);

/** GET /api/users/me/export — download all personal data (GDPR / DPDP) */
router.get('/me/export', authenticate, userController.exportData);

/** DELETE /api/users/me — permanently delete account (requires password) */
router.delete('/me', authenticate, loginLimiter, userController.deleteAccount);

module.exports = router;
