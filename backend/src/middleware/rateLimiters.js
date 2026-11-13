const { rateLimit } = require('express-rate-limit');
const { config } = require('../config/env');

const passthrough = (req, res, next) => next();

const build = (options) => {
  const limiter = rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next, opts) => {
      res.status(opts.statusCode).json({
        status: 'error',
        message: opts.message,
      });
    },
    ...options,
  });
  // Evaluate the toggle per request so tests can switch it at runtime.
  return (req, res, next) => (config.rateLimitEnabled ? limiter(req, res, next) : passthrough(req, res, next));
};

/** Broad protection for the whole API. */
const apiLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests, please try again later.',
});

/** Brute-force protection for credential endpoints (counts failures only). */
const loginLimiter = build({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many failed login attempts. Please try again in 15 minutes.',
});

/** Abuse protection for endpoints that send emails or create accounts. */
const sensitiveLimiter = build({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Too many requests for this action. Please try again later.',
});

module.exports = { apiLimiter, loginLimiter, sensitiveLimiter };
