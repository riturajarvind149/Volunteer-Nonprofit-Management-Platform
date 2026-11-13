require('dotenv').config({ quiet: true });
const { config, validateEnv } = require('./config/env');
const logger = require('./utils/logger');

try {
  validateEnv();
} catch (err) {
  logger.fatal(err.message);
  process.exit(1);
}

const app = require('./app');
const pool = require('./config/db');
const { migrate } = require('./db/migrate');
const { startSchedulers, stopSchedulers } = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;
let server;

const start = async () => {
  if (process.env.SKIP_MIGRATIONS !== 'true') {
    await migrate({ log: (msg) => logger.info(msg) });
  }

  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} (${config.nodeEnv})`);

    if (process.env.DISABLE_SCHEDULER !== 'true') {
      startSchedulers();
      logger.info('[Scheduler] Background jobs started');
    }
  });
};

let shuttingDown = false;
const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);
  stopSchedulers();

  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  const closeServer = server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve();
  closeServer
    .then(() => pool.end())
    .then(() => {
      logger.info('HTTP server and database pool closed');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Error during shutdown');
      process.exit(1);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
