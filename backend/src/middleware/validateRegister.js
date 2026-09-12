const AppError = require('../utils/AppError');

const ALLOWED_ROLES = ['VOLUNTEER', 'COORDINATOR'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegister = (req, res, next) => {
  const { full_name, email, password, role } = req.body;

  // 1. Check for missing required fields
  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return next(new AppError('Full name is required and must be a valid text string', 400));
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return next(new AppError('Email is required', 400));
  }

  if (!password || typeof password !== 'string') {
    return next(new AppError('Password is required', 400));
  }

  if (!role || typeof role !== 'string') {
    return next(new AppError('Role is required', 400));
  }

  // 2. Validate full_name length
  const trimmedName = full_name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 255) {
    return next(new AppError('Full name must be between 2 and 255 characters', 400));
  }

  // 3. Validate email format & length
  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 255) {
    return next(new AppError('Please provide a valid email address', 400));
  }

  // 4. Validate password length & suitability
  if (password.length < 8) {
    return next(new AppError('Password must be at least 8 characters long', 400));
  }

  // 5. Validate role
  const normalizedRole = role.trim().toUpperCase();
  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    return next(new AppError('Invalid role. Role must be either VOLUNTEER or COORDINATOR', 400));
  }

  // Attach sanitized values back to req.body
  req.body.full_name = trimmedName;
  req.body.email = trimmedEmail;
  req.body.role = normalizedRole;

  next();
};

module.exports = validateRegister;
