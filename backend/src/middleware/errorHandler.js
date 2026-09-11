// Centralized error-handling middleware foundation

const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.isOperational || statusCode < 500
    ? err.message
    : 'Internal Server Error';

  // Handle PostgreSQL unique constraint violation (code 23505) safely
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Email is already registered';
  }

  res.status(statusCode).json({
    status: 'error',
    message,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
