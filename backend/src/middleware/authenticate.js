const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');

/**
 * Resolve and verify the bearer token on a request.
 * Besides the JWT signature/expiry, the user's current state is checked in
 * the database so that suspended accounts, role changes and revoked sessions
 * (password change / "log out everywhere") take effect immediately.
 *
 * @returns {Promise<{id: string, role: string}>}
 */
const resolveUser = async (req) => {
  const authHeader = req.headers.authorization;

  // 1. Check for presence of Authorization header
  if (!authHeader) {
    throw new AppError('Authorization header is required', 401);
  }

  // 2. Validate Bearer scheme format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
    throw new AppError('Authorization header must use the Bearer scheme', 401);
  }

  const token = parts[1].trim();

  // 3. Ensure server has JWT_SECRET configured
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is not configured on the server', 500);
  }

  // 4. Verify token cryptographically (signature and expiration)
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    throw new AppError('Authentication failed', 401);
  }

  // 5. Check live account state
  const state = await userRepository.findAuthStateById(decoded.id);
  if (!state) {
    throw new AppError('Account no longer exists', 401);
  }
  if (!state.is_active) {
    throw new AppError('This account has been suspended', 403, 'ACCOUNT_SUSPENDED');
  }
  if ((decoded.tv ?? 0) !== state.token_version) {
    throw new AppError('Session has been revoked. Please log in again.', 401, 'SESSION_REVOKED');
  }

  return { id: state.id, role: state.role };
};

/**
 * Middleware to authenticate requests using JWT Bearer token.
 * Binds verified user data to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    req.user = await resolveUser(req);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Like authenticate, but anonymous requests are allowed (req.user stays undefined).
 * A present-but-invalid token is still rejected so clients notice expired sessions.
 */
const optionalAuthenticate = async (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
};

module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.optionalAuthenticate = optionalAuthenticate;
