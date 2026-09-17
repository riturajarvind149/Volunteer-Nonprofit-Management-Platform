const AppError = require('../utils/AppError');

/**
 * Reusable Role-Based Authorization Middleware.
 *
 * Verifies that the authenticated user (bound to req.user by authenticate.js)
 * possesses at least one of the allowed roles for the requested route.
 *
 * Usage:
 *   router.get('/coordinator-only', authenticate, authorizeRoles('COORDINATOR'), handler);
 *   router.get('/shared', authenticate, authorizeRoles('VOLUNTEER', 'COORDINATOR'), handler);
 *
 * @param {...string|string[]} roles - One or more permitted role strings or array of roles
 * @returns {Function} Express middleware function
 */
const authorizeRoles = (...roles) => {
  // Support both spread arguments authorizeRoles('ROLE1', 'ROLE2') and array authorizeRoles(['ROLE1', 'ROLE2'])
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    // 1. Ensure authenticated identity exists from preceding authenticate middleware
    if (!req.user || !req.user.role) {
      return next(
        new AppError('Forbidden: Authentication required or user role not identified', 403)
      );
    }

    // 2. Check if the verified user role is permitted
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError('Forbidden: You do not have permission to access this resource', 403)
      );
    }

    // 3. User is authorized, proceed to the next middleware or controller
    next();
  };
};

module.exports = authorizeRoles;
