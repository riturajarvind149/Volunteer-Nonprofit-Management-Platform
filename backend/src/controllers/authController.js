const authService = require('../services/authService');
const { config } = require('../config/env');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register
 */
const register = handle(async (req, res) => {
  const { full_name, email, password, role } = req.body;
  const user = await authService.registerUser({ full_name, email, password, role });

  const needsVerification = config.requireEmailVerification && !user.email_verified_at;
  res.status(201).json({
    status: 'success',
    message: needsVerification
      ? 'Registration successful. Please check your email to verify your account.'
      : 'User registered successfully',
    data: {
      user,
      requires_email_verification: needsVerification,
    },
  });
});

/**
 * POST /api/auth/login
 */
const login = handle(async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await authService.loginUser({ email, password });

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: { token, user },
  });
});

/**
 * GET /api/auth/me
 */
const getMe = handle(async (req, res) => {
  const user = await authService.getUserProfile(req.user.id);
  res.status(200).json({
    status: 'success',
    message: 'Authenticated user profile retrieved',
    data: { user },
  });
});

/** Demonstration endpoints (registered only outside production). */
const coordinatorTest = (req, res) => {
  res.status(200).json({ status: 'success', message: 'Coordinator authorization successful', data: { user: req.user } });
};
const volunteerTest = (req, res) => {
  res.status(200).json({ status: 'success', message: 'Volunteer authorization successful', data: { user: req.user } });
};

/**
 * POST /api/auth/change-password
 */
const changePassword = handle(async (req, res) => {
  const { current_password, new_password } = req.body;
  const result = await authService.changePassword(req.user.id, current_password, new_password);
  res.status(200).json({
    status: 'success',
    message: result.message,
    data: { token: result.token },
  });
});

/**
 * POST /api/auth/verify-email  { token }
 */
const verifyEmail = handle(async (req, res) => {
  const result = await authService.verifyEmail(req.body?.token);
  res.status(200).json({ status: 'success', message: result.message });
});

/**
 * POST /api/auth/resend-verification  { email }
 */
const resendVerification = handle(async (req, res) => {
  const result = await authService.resendVerification(req.body?.email);
  res.status(200).json({ status: 'success', message: result.message });
});

/**
 * POST /api/auth/forgot-password  { email }
 */
const forgotPassword = handle(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body?.email);
  res.status(200).json({ status: 'success', message: result.message });
});

/**
 * POST /api/auth/reset-password  { token, password }
 */
const resetPassword = handle(async (req, res) => {
  const result = await authService.resetPassword(req.body?.token, req.body?.password);
  res.status(200).json({ status: 'success', message: result.message });
});

/**
 * POST /api/auth/logout-all
 */
const logoutAll = handle(async (req, res) => {
  const result = await authService.logoutAllSessions(req.user.id);
  res.status(200).json({ status: 'success', message: result.message });
});

module.exports = {
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
};
