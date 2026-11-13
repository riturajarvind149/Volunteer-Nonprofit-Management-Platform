const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const authTokenRepository = require('../repositories/authTokenRepository');
const emailService = require('./emailService');
const templates = require('./emailTemplates');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MIN = 24 * 60;
const PASSWORD_RESET_TTL_MIN = 60;
const MAX_TOKENS_PER_HOUR = 5;

// Pre-computed hash used to equalise timing when an email does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 10);

/**
 * Generate a signed JWT containing minimal, non-sensitive claims.
 * `tv` (token version) lets the server revoke all sessions for a user.
 */
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is not configured on the server', 500);
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      tv: user.token_version ?? 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: config.jwtExpiresIn,
      algorithm: 'HS256',
    }
  );
};

const validatePasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }
  if (password.length > 72) {
    throw new AppError('Password must be at most 72 characters long', 400);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new AppError('Password must contain at least one letter and one number', 400);
  }
};

const sendVerificationEmail = async (user) => {
  const token = await authTokenRepository.issue(user.id, 'EMAIL_VERIFICATION', EMAIL_VERIFICATION_TTL_MIN);
  await emailService.sendEmail({
    to: user.email,
    ...templates.verifyEmail({ name: user.full_name, token }),
  });
};

/**
 * Service to handle user registration business logic
 */
const registerUser = async ({ full_name, email, password, role }) => {
  validatePasswordStrength(password);

  // 1. Check if email is already taken (Application-level validation)
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  // 2. Hash password with bcrypt
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // 3. Persist to database via repository
  let newUser;
  try {
    newUser = await userRepository.createUser({
      full_name,
      email,
      password_hash,
      role,
    });
  } catch (error) {
    // Handle database-level UNIQUE constraint violation (code 23505)
    if (error.code === '23505') {
      throw new AppError('Email is already registered', 409);
    }
    throw error;
  }

  // Ensure password_hash is never exposed
  delete newUser.password_hash;

  // 4. Email verification (auto-verify when the feature is disabled)
  if (config.requireEmailVerification) {
    await sendVerificationEmail(newUser);
  } else {
    newUser = (await userRepository.markEmailVerified(newUser.id)) || newUser;
  }

  return newUser;
};

/**
 * Service to handle user login business logic
 */
const loginUser = async ({ email, password }) => {
  // 1. Find user by email
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Burn comparable CPU time to prevent user enumeration via timing
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError('Invalid email or password', 401);
  }

  // 2. Compare password with bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    // Identical generic error
    throw new AppError('Invalid email or password', 401);
  }

  // 3. Account state checks (only revealed after a correct password)
  if (!user.is_active) {
    throw new AppError('This account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
  }
  if (config.requireEmailVerification && !user.email_verified_at) {
    throw new AppError(
      'Please verify your email address before logging in. Check your inbox for the verification link.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  // 4. Generate JWT access token
  const token = generateToken(user);
  await userRepository.touchLastLogin(user.id);

  // 5. Strip sensitive fields before returning
  delete user.password_hash;
  delete user.token_version;

  return {
    token,
    user,
  };
};

/**
 * Service to retrieve authenticated user profile by ID
 */
const getUserProfile = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

/**
 * Service to change authenticated user's password.
 * Revokes all existing sessions and returns a fresh token for the caller.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400);
  }
  validatePasswordStrength(newPassword);

  const currentHash = await userRepository.findPasswordHashById(userId);
  if (!currentHash) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, currentHash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepository.updatePassword(userId, newHash);

  const user = await userRepository.findById(userId);
  const fresh = await userRepository.findByEmail(user.email);
  emailService.queueEmail({ to: user.email, ...templates.passwordChanged({ name: user.full_name }) });

  return { message: 'Password updated successfully', token: generateToken(fresh) };
};

/**
 * Confirm an email address using a one-time token.
 */
const verifyEmail = async (token) => {
  if (!token || typeof token !== 'string') {
    throw new AppError('Verification token is required', 400);
  }
  const record = await authTokenRepository.consume(token, 'EMAIL_VERIFICATION');
  if (!record) {
    throw new AppError('This verification link is invalid or has expired', 400, 'INVALID_TOKEN');
  }
  const user = await userRepository.markEmailVerified(record.user_id);
  return { message: 'Email verified successfully. You can now log in.', user };
};

/**
 * Resend the verification email. Always responds generically.
 */
const resendVerification = async (email) => {
  const generic = { message: 'If an unverified account exists for this email, a new verification link has been sent.' };
  if (!email || typeof email !== 'string') return generic;
  const user = await userRepository.findByEmail(email.trim().toLowerCase());
  if (!user || user.email_verified_at || !user.is_active) return generic;
  if ((await authTokenRepository.countRecent(user.id, 'EMAIL_VERIFICATION')) >= MAX_TOKENS_PER_HOUR) return generic;
  await sendVerificationEmail(user);
  return generic;
};

/**
 * Start the password reset flow. Always responds generically to avoid
 * revealing which emails are registered.
 */
const requestPasswordReset = async (email) => {
  const generic = { message: 'If an account exists for this email, a password reset link has been sent.' };
  if (!email || typeof email !== 'string') {
    throw new AppError('Email is required', 400);
  }
  const user = await userRepository.findByEmail(email.trim().toLowerCase());
  if (!user || !user.is_active) return generic;
  if ((await authTokenRepository.countRecent(user.id, 'PASSWORD_RESET')) >= MAX_TOKENS_PER_HOUR) return generic;

  const token = await authTokenRepository.issue(user.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MIN);
  await emailService.sendEmail({
    to: user.email,
    ...templates.passwordReset({ name: user.full_name, token }),
  });
  return generic;
};

/**
 * Complete a password reset with a one-time token.
 * All existing sessions are revoked. A successful reset also proves email ownership.
 */
const resetPassword = async (token, newPassword) => {
  if (!token || typeof token !== 'string') {
    throw new AppError('Reset token is required', 400);
  }
  validatePasswordStrength(newPassword);

  const record = await authTokenRepository.consume(token, 'PASSWORD_RESET');
  if (!record) {
    throw new AppError('This reset link is invalid or has expired', 400, 'INVALID_TOKEN');
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepository.updatePassword(record.user_id, newHash);
  const user = await userRepository.markEmailVerified(record.user_id);
  if (user) {
    emailService.queueEmail({ to: user.email, ...templates.passwordChanged({ name: user.full_name }) });
  }
  return { message: 'Password has been reset. You can now log in with your new password.' };
};

/**
 * Revoke every session for the user (including the current one).
 */
const logoutAllSessions = async (userId) => {
  await userRepository.incrementTokenVersion(userId);
  return { message: 'Signed out of all sessions' };
};

module.exports = {
  registerUser,
  loginUser,
  generateToken,
  getUserProfile,
  changePassword,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  logoutAllSessions,
  validatePasswordStrength,
};
