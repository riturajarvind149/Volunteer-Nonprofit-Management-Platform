// Centralized error-handling middleware foundation

const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational || statusCode < 500
    ? err.message
    : 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    message,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
