const express = require('express');
const {
  register,
  login,
  getMe,
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
const { loginLimiter, sensitiveLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register', sensitiveLimiter, validateRegister, register);
router.post('/login', loginLimiter, validateLogin, login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, loginLimiter, changePassword);
router.post('/verify-email', loginLimiter, verifyEmail);
router.post('/resend-verification', sensitiveLimiter, resendVerification);
router.post('/forgot-password', sensitiveLimiter, forgotPassword);
router.post('/reset-password', loginLimiter, resetPassword);
router.post('/logout-all', authenticate, logoutAll);

module.exports = router;
