const AppError = require('../utils/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Middleware to validate login request input
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  // 1. Check for missing email
  if (!email || typeof email !== 'string' || !email.trim()) {
    return next(new AppError('Email is required', 400));
  }

  // 2. Check for missing password
  if (!password || typeof password !== 'string' || !password.trim()) {
    return next(new AppError('Password is required', 400));
  }

  // 3. Validate email format
  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return next(new AppError('Please provide a valid email address', 400));
  }

  // Attach sanitized email
  req.body.email = trimmedEmail;

  next();
};

module.exports = validateLogin;
