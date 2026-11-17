const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const authTokenRepository = require('../repositories/authTokenRepository');
const emailService = require('./emailService');
const templates = require('./emailTemplates');
const { config } = require('../config/env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MIN = 24 * 60;
const PASSWORD_RESET_TTL_MIN = 60;
const MAX_TOKENS_PER_HOUR = 5;

/**
 * Email verification is only enforced when the platform can actually deliver email.
 * Requiring it while SMTP is missing or broken would lock every new user out.
 */
const isVerificationRequired = () => config.requireEmailVerification && emailService.canDeliverEmail();

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

const normaliseEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const notRegistered = () =>
  new AppError('No account is registered with this email address. Check it or create an account.', 404, 'EMAIL_NOT_REGISTERED');

/** Look up the account behind an email, or explain clearly that there isn't one. */
const findRegisteredUser = async (email) => {
  const normalised = normaliseEmail(email);
  if (!normalised) throw new AppError('Email is required', 400);
  const user = await userRepository.findByEmail(normalised);
  if (!user) throw notRegistered();
  return user;
};

const assertCodeFormat = (code) => {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw new AppError('Enter the 6-digit code from the email.', 400, 'INVALID_CODE');
  }
  return code.trim();
};

/** Turn a failed code check into a helpful error. */
const codeError = (result, kind) => {
  if (result.status === 'none') {
    return new AppError(`This code has expired or was already used. Request a new ${kind} email.`, 400, 'INVALID_CODE');
  }
  if (result.remaining === 0) {
    return new AppError(`Too many incorrect attempts. Request a new ${kind} email.`, 400, 'INVALID_CODE');
  }
  return new AppError(
    `Incorrect code. ${result.remaining} attempt${result.remaining === 1 ? '' : 's'} left.`,
    400,
    'INVALID_CODE'
  );
};

const assertUnderHourlyLimit = async (userId, type) => {
  if ((await authTokenRepository.countRecent(userId, type)) >= MAX_TOKENS_PER_HOUR) {
    throw new AppError(
      `Too many emails requested (limit ${MAX_TOKENS_PER_HOUR} per hour). Use the code from your latest email or try again later.`,
      429,
      'EMAIL_LIMIT_REACHED'
    );
  }
};

/** Email is configured but the send failed: tell the user instead of pretending it was sent. */
const assertSent = (result, userId, kind) => {
  if (result?.delivered || result?.logged) return;
  logger.warn({ userId }, `[email] ${kind} email could not be delivered`);
  throw new AppError('We could not send the email right now. Please try again in a few minutes.', 503, 'EMAIL_SEND_FAILED');
};

/** @returns {Promise<{delivered: boolean}>} result of the send attempt */
const sendVerificationEmail = async (user) => {
  const { token, code } = await authTokenRepository.issue(user.id, 'EMAIL_VERIFICATION', EMAIL_VERIFICATION_TTL_MIN);
  const result = await emailService.sendEmail({
    to: user.email,
    ...templates.verifyEmail({ name: user.full_name, token, code }),
  });
  if (result?.delivered) logger.info({ userId: user.id }, '[email] verification email sent');
  return result || { delivered: false };
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
  if (isVerificationRequired()) {
    const sent = await sendVerificationEmail(newUser);
    // Email turned out to be down (e.g. blocked SMTP port) — don't leave the user stuck unverified.
    if (!sent.delivered && !emailService.canDeliverEmail()) {
      logger.warn({ userId: newUser.id }, '[email] verification email could not be delivered; account verified automatically');
      newUser = (await userRepository.markEmailVerified(newUser.id)) || newUser;
    }
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
  const user = await userRepository.findByEmail(normaliseEmail(email));
  if (!user) throw notRegistered();

  // 2. Compare password with bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Incorrect password. Try again or use "Forgot password?" to reset it.', 401, 'INVALID_PASSWORD');
  }

  // 3. Account state checks (only revealed after a correct password)
  if (!user.is_active) {
    throw new AppError('This account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
  }
  if (isVerificationRequired() && !user.email_verified_at) {
    throw new AppError(
      'Please verify your email address before logging in. Enter the 6-digit code from the verification email.',
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
  return { message: VERIFIED_MESSAGE, user };
};

const VERIFIED_MESSAGE = 'Email verified successfully. You can now log in.';
const ALREADY_VERIFIED = { message: 'This email is already verified. You can log in.', alreadyVerified: true };

/**
 * Confirm an email address with the 6-digit code from the verification email.
 */
const verifyEmailCode = async (email, code) => {
  const cleanCode = assertCodeFormat(code);
  const user = await findRegisteredUser(email);
  if (user.email_verified_at) return ALREADY_VERIFIED;
  const result = await authTokenRepository.consumeCode(user.id, 'EMAIL_VERIFICATION', cleanCode);
  if (result.status !== 'ok') throw codeError(result, 'verification');
  await userRepository.markEmailVerified(user.id);
  return { message: VERIFIED_MESSAGE };
};

/**
 * Send a new verification code + link.
 */
const resendVerification = async (email) => {
  const user = await findRegisteredUser(email);
  if (user.email_verified_at) return ALREADY_VERIFIED;
  if (!user.is_active) {
    throw new AppError('This account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
  }
  await assertUnderHourlyLimit(user.id, 'EMAIL_VERIFICATION');
  assertSent(await sendVerificationEmail(user), user.id, 'verification');
  return { message: `A new verification code has been sent to ${user.email}. It expires in 24 hours.` };
};

/**
 * Start the password reset flow: email a reset code + link.
 */
const requestPasswordReset = async (email) => {
  const user = await findRegisteredUser(email);
  if (!user.is_active) {
    throw new AppError('This account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
  }
  await assertUnderHourlyLimit(user.id, 'PASSWORD_RESET');

  const { token, code } = await authTokenRepository.issue(user.id, 'PASSWORD_RESET', PASSWORD_RESET_TTL_MIN);
  const result = await emailService.sendEmail({
    to: user.email,
    ...templates.passwordReset({ name: user.full_name, token, code }),
  });
  assertSent(result, user.id, 'password reset');
  return { message: `A password reset code has been sent to ${user.email}. It expires in 60 minutes.` };
};

/** Shared last step of both reset paths. A successful reset also proves email ownership. */
const finishPasswordReset = async (userId, newPassword) => {
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepository.updatePassword(userId, newHash);
  const user = await userRepository.markEmailVerified(userId);
  if (user) {
    emailService.queueEmail({ to: user.email, ...templates.passwordChanged({ name: user.full_name }) });
  }
  return { message: 'Password has been reset. You can now log in with your new password.' };
};

/**
 * Complete a password reset with the one-time link token. All existing sessions are revoked.
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
  return finishPasswordReset(record.user_id, newPassword);
};

/**
 * Complete a password reset with the 6-digit code from the email.
 */
const resetPasswordWithCode = async (email, code, newPassword) => {
  const cleanCode = assertCodeFormat(code);
  // Check the password first so a typo in it doesn't use up a code attempt.
  validatePasswordStrength(newPassword);
  const user = await findRegisteredUser(email);
  const result = await authTokenRepository.consumeCode(user.id, 'PASSWORD_RESET', cleanCode);
  if (result.status !== 'ok') throw codeError(result, 'password reset');
  return finishPasswordReset(user.id, newPassword);
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
  verifyEmailCode,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  resetPasswordWithCode,
  logoutAllSessions,
  validatePasswordStrength,
  isVerificationRequired,
};
