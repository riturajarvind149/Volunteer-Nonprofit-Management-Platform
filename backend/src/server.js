require('dotenv').config();
const app = require('./app');
const {
  startOpportunityCompletionScheduler,
  stopOpportunityCompletionScheduler,
} = require('./services/opportunityCompletionService');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  if (process.env.DISABLE_SCHEDULER !== 'true') {
    startOpportunityCompletionScheduler();
    console.log('[Scheduler] Opportunity completion scheduler started');
  }
});

const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  stopOpportunityCompletionScheduler();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);