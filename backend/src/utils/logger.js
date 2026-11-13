const pino = require('pino');
const { config } = require('../config/env');

/**
 * Structured JSON logger. Sensitive fields are redacted automatically.
 */
const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.password_hash',
      '*.token',
      '*.new_password',
      '*.current_password',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = logger;
