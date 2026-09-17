const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

/**
 * Middleware to authenticate requests using JWT Bearer token
 * Verifies token signature, expiration, and binds verified user data to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1. Check for presence of Authorization header
  if (!authHeader) {
    return next(new AppError('Authorization header is required', 401));
  }

  // 2. Validate Bearer scheme format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
    return next(new AppError('Authorization header must use the Bearer scheme', 401));
  }

  const token = parts[1].trim();

  // 3. Ensure server has JWT_SECRET configured
  if (!process.env.JWT_SECRET) {
    return next(new AppError('JWT_SECRET is not configured on the server', 500));
  }

  // 4. Verify token cryptographically (signature and expiration)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5. Attach safe authenticated user identity to req.user
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    return next(new AppError('Authentication failed', 401));
  }
};

module.exports = authenticate;
