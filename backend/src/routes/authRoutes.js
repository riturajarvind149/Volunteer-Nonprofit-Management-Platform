const express = require('express');
const {
  register,
  login,
  getMe,
  coordinatorTest,
  volunteerTest,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  logoutAll,
} = require('../controllers/authController');
const validateRegister = require('../middleware/validateRegister');
const validateLogin = require('../middleware/validateLogin');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { loginLimiter, sensitiveLimiter } = require('../middleware/rateLimiters');
const { config } = require('../config/env');

const router = express.Router();

router.post('/register', sensitiveLimiter, validateRegister, register);
router.post('/login', loginLimiter, validateLogin, login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, loginLimiter, changePassword);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', sensitiveLimiter, resendVerification);
router.post('/forgot-password', sensitiveLimiter, forgotPassword);
router.post('/reset-password', loginLimiter, resetPassword);
router.post('/logout-all', authenticate, logoutAll);

// Role-check demo endpoints are only exposed outside production.
if (!config.isProduction) {
  router.get('/coordinator-test', authenticate, authorizeRoles('COORDINATOR'), coordinatorTest);
  router.get('/volunteer-test', authenticate, authorizeRoles('VOLUNTEER'), volunteerTest);
}

module.exports = router;
