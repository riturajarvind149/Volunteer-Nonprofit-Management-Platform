const authService = require('../services/authService');

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

  const needsVerification = authService.isVerificationRequired() && !user.email_verified_at;
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
 * POST /api/auth/register-organization — public NGO sign-up (NGO admin + NGO in one step)
 */
const registerOrganization = handle(async (req, res) => {
  const { user, organization } = await authService.registerOrganization(req.representative, req.ngo);
  const needsVerification = authService.isVerificationRequired() && !user.email_verified_at;
  res.status(201).json({
    status: 'success',
    message: needsVerification
      ? 'NGO registered. Please check your email to verify your account.'
      : 'NGO registered successfully',
    data: { user, organization, requires_email_verification: needsVerification },
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
 * POST /api/auth/verify-email  { token }  (link)  or  { email, code }  (6-digit code)
 */
const verifyEmail = handle(async (req, res) => {
  const { token, email, code } = req.body || {};
  const result = code !== undefined
    ? await authService.verifyEmailCode(email, code)
    : await authService.verifyEmail(token);
  res.status(200).json({ status: 'success', message: result.message });
});

/**
 * POST /api/auth/resend-verification  { email }
 */
const resendVerification = handle(async (req, res) => {
  const result = await authService.resendVerification(req.body?.email);
  res.status(200).json({
    status: 'success',
    message: result.message,
    data: { already_verified: Boolean(result.alreadyVerified) },
  });
});

/**
 * POST /api/auth/forgot-password  { email }
 */
const forgotPassword = handle(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body?.email);
  res.status(200).json({ status: 'success', message: result.message });
});

/**
 * POST /api/auth/reset-password  { token, password }  or  { email, code, password }
 */
const resetPassword = handle(async (req, res) => {
  const { token, email, code, password } = req.body || {};
  const result = code !== undefined
    ? await authService.resetPasswordWithCode(email, code, password)
    : await authService.resetPassword(token, password);
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
  registerOrganization,
  login,
  getMe,
  changePassword,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  logoutAll,
};
