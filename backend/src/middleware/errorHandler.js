const logger = require('../utils/logger');

const notFoundHandler = (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const UNIQUE_MESSAGES = {
  uq_signups_volunteer_opportunity: 'You have already signed up for this opportunity.',
  uq_waitlist_volunteer_opportunity: 'You are already on the waitlist for this opportunity.',
  users_email_key: 'Email is already registered',
  idx_users_email_lower: 'Email is already registered',
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.isOperational || statusCode < 500 ? err.message : 'Internal Server Error';
  const extra = {};

  if (err.code && err.isOperational) {
    extra.code = err.code;
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body contains invalid JSON';
  }

  // Body exceeds size limit
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  }

  // CORS rejection
  if (typeof err.message === 'string' && err.message.startsWith('CORS:')) {
    statusCode = 403;
    message = 'Origin not allowed';
  }

  // PostgreSQL errors
  if (err.code === '23505') {
    statusCode = 409;
    message = UNIQUE_MESSAGES[err.constraint] || 'A record with these details already exists';
  } else if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid input syntax';
  } else if (err.code === '23503') {
    statusCode = 409;
    message = 'This record is referenced by other data and cannot be changed';
  } else if (err.code === '23514') {
    statusCode = 400;
    message = 'Value violates a data constraint';
  }

  if (statusCode >= 500) {
    (req.log || logger).error({ err }, 'Unhandled error');
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...extra,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
