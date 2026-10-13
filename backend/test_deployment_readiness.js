require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./src/config/db');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const runTests = async () => {
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  DEPLOYMENT READINESS VERIFICATION TEST SUITE       ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  const assert = (condition, description, detail = '') => {
    if (condition) {
      console.log(` ${colors.green}✔ PASS${colors.reset} - ${description}`);
      passed++;
    } else {
      console.log(` ${colors.red}✖ FAIL${colors.reset} - ${description}`);
      if (detail) console.log(`   ${colors.red}${detail}${colors.reset}`);
      failed++;
    }
  };

  const getSslConfig = pool.getSslConfig;

  // 1. SSL Configuration Tests
  console.log(`\n--> Section 1: PostgreSQL SSL Configuration Logic...`);

  assert(
    typeof getSslConfig === 'function',
    'getSslConfig function is exported and accessible on pool'
  );

  assert(
    getSslConfig({ NODE_ENV: 'development' }) === false,
    'Default development environment disables SSL'
  );

  assert(
    getSslConfig({ NODE_ENV: 'test' }) === false,
    'Default test environment disables SSL'
  );

  assert(
    getSslConfig({ NODE_ENV: 'production', DATABASE_SSL: 'false' }) === false,
    'DATABASE_SSL="false" explicitly disables SSL even in production'
  );

  assert(
    getSslConfig({ NODE_ENV: 'production', DATABASE_SSL: '0' }) === false,
    'DATABASE_SSL="0" explicitly disables SSL even in production'
  );

  const prodDefault = getSslConfig({ NODE_ENV: 'production' });
  assert(
    typeof prodDefault === 'object' && prodDefault.rejectUnauthorized === false,
    'Default production enables SSL with rejectUnauthorized: false for cloud providers'
  );

  const explicitEnabled = getSslConfig({ NODE_ENV: 'development', DATABASE_SSL: 'true' });
  assert(
    typeof explicitEnabled === 'object' && explicitEnabled.rejectUnauthorized === false,
    'DATABASE_SSL="true" enables SSL with rejectUnauthorized: false'
  );

  const strictVerification = getSslConfig({
    NODE_ENV: 'production',
    DATABASE_SSL_REJECT_UNAUTHORIZED: 'true',
  });
  assert(
    typeof strictVerification === 'object' && strictVerification.rejectUnauthorized === true,
    'DATABASE_SSL_REJECT_UNAUTHORIZED="true" enforces strict certificate validation'
  );

  const caCertConfig = getSslConfig({
    NODE_ENV: 'production',
    DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----',
  });
  assert(
    typeof caCertConfig === 'object' && caCertConfig.ca.includes('MOCK'),
    'DATABASE_CA_CERT attaches custom CA certificate to SSL options'
  );

  // 2. Database Schema and initDb Tests
  console.log(`\n--> Section 2: Database Schema & initDb Path Resolution...`);

  const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
  assert(
    fs.existsSync(schemaPath),
    'schema.sql exists at resolved path src/db/schema.sql'
  );

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  assert(
    schemaContent.includes('CREATE TABLE IF NOT EXISTS users') &&
    schemaContent.includes('CREATE TABLE IF NOT EXISTS notifications') &&
    schemaContent.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_event_completed'),
    'schema.sql contains expected core tables and unique index definitions'
  );

  const initDbPath = path.join(__dirname, 'src', 'db', 'initDb.js');
  assert(
    fs.existsSync(initDbPath),
    'src/db/initDb.js exists at resolved path'
  );

  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert(
    pkg.scripts && pkg.scripts['db:init'] === 'node src/db/initDb.js',
    'package.json contains "db:init": "node src/db/initDb.js" script'
  );

  // 3. Schema Idempotency Syntax Inspection
  console.log(`\n--> Section 3: Schema Idempotency Verification...`);

  const nonIfStatements = schemaContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .filter(s => {
      const upper = s.toUpperCase();
      return (
        !upper.includes('IF NOT EXISTS') &&
        !upper.includes('CREATE EXTENSION') &&
        !upper.startsWith('COMMENT')
      );
    });

  assert(
    nonIfStatements.length === 0,
    'All DDL statements in schema.sql use IF NOT EXISTS clauses for idempotency',
    nonIfStatements.length > 0 ? `Statements lacking IF NOT EXISTS: ${nonIfStatements.join('; ')}` : ''
  );

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`  DEPLOYMENT READINESS RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
