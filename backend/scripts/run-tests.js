/**
 * Cross-platform test runner.
 * Runs every suite in sequence with a test-safe environment and stops on the first failure.
 *
 *   npm test                 -> all suites
 *   npm test -- signup       -> only suites whose file name contains "signup"
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = [
  'test_registration.js',
  'test_login.js',
  'test_auth_middleware.js',
  'test_auth_rbac.js',
  'test_organization.js',
  'test_opportunity.js',
  'test_signup.js',
  'test_volunteer_hours.js',
  'test_volunteer_hours_retrieval.js',
  'test_volunteer_hours_status.js',
  'test_volunteer_hours_summary.js',
  'test_volunteer_hours_opportunity.js',
  'test_volunteer_hours_date.js',
  'test_volunteer_hours_my_date.js',
  'test_signup_status.js',
  'test_signup_detail.js',
  'test_opportunity_update.js',
  'test_batch1_integration.js',
  'test_batch2_mysignups.js',
  'test_batch3_coordinator_ui.js',
  'test_batch4_attendees.js',
  'test_volunteer_hours_idempotency.js',
  'test_batch5_capabilities.js',
  'test_opportunity_auto_completion.js',
  'test_production_features.js',
  'test_deployment_readiness.js',
];

const filter = process.argv[2];
const selected = filter ? SUITES.filter((s) => s.includes(filter)) : SUITES;

const env = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: process.env.LOG_LEVEL || 'silent',
  RATE_LIMIT_ENABLED: 'false',
  // Legacy suites predate email verification / org approval; the dedicated
  // production-features suite switches these on itself.
  REQUIRE_EMAIL_VERIFICATION: 'false',
  REQUIRE_ORG_APPROVAL: 'false',
  DISABLE_SCHEDULER: 'true',
};

const failed = [];
for (const suite of selected) {
  console.log(`\n▶ ${suite}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'tests', suite)], { stdio: 'inherit', env });
  if (result.status !== 0) {
    failed.push(suite);
    break;
  }
}

if (failed.length) {
  console.error(`\n✖ Failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\n✔ ${selected.length} suite(s) passed`);
