require('dotenv').config();
const bcrypt = require('bcrypt');
const app = require('./src/app');
const pool = require('./src/config/db');

let server;
let baseUrl;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const runTests = async () => {
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  DAY 10: USER REGISTRATION FOUNDATION TEST SUITE   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  let passed = 0;
  let failed = 0;

  const assert = (condition, description, detail = '') => {
    if (condition) {
      console.log(` ${colors.green}✔ PASS${colors.reset} - ${description}`);
      passed++;
    } else {
      console.error(` ${colors.red}✖ FAIL${colors.reset} - ${description}`);
      if (detail) console.error(`        Detail: ${detail}`);
      failed++;
    }
  };

  // Start server on an ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  const testEmails = [
    'john.volunteer@test.org',
    'sarah.coord@test.org',
    'duplicate.test@test.org',
  ];

  // Cleanup any leftover test records before starting
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

  let volunteerResponseData = null;
  let coordinatorResponseData = null;

  try {
    // ----------------------------------------------------------------
    // 1. Valid volunteer registration
    // ----------------------------------------------------------------
    console.log(`${colors.bold}Test 1: Valid volunteer registration${colors.reset}`);
    const res1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'John Volunteer',
        email: 'john.volunteer@test.org',
        password: 'SecretPassword123!',
        role: 'VOLUNTEER',
      }),
    });
    const data1 = await res1.json();
    volunteerResponseData = data1;

    assert(
      res1.status === 201 && data1.status === 'success' && data1.data?.user?.role === 'VOLUNTEER',
      'Volunteer registration returns HTTP 201 with role VOLUNTEER',
      JSON.stringify(data1)
    );
    assert(
      data1.data?.user?.full_name === 'John Volunteer' && data1.data?.user?.email === 'john.volunteer@test.org',
      'Volunteer registration returns correct user info'
    );

    // ----------------------------------------------------------------
    // 2. Valid coordinator registration
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 2: Valid coordinator registration${colors.reset}`);
    const res2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Sarah Coordinator',
        email: 'sarah.coord@test.org',
        password: 'CoordinatorPass123!',
        role: 'COORDINATOR',
      }),
    });
    const data2 = await res2.json();
    coordinatorResponseData = data2;

    assert(
      res2.status === 201 && data2.status === 'success' && data2.data?.user?.role === 'COORDINATOR',
      'Coordinator registration returns HTTP 201 with role COORDINATOR',
      JSON.stringify(data2)
    );

    // ----------------------------------------------------------------
    // 3. Missing required field
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 3: Missing required field${colors.reset}`);
    const res3 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Missing Password User',
        email: 'nopass@test.org',
        role: 'VOLUNTEER',
      }),
    });
    const data3 = await res3.json();

    assert(
      res3.status === 400 && data3.status === 'error' && data3.message.includes('Password is required'),
      'Missing password returns HTTP 400 with descriptive error',
      JSON.stringify(data3)
    );

    // ----------------------------------------------------------------
    // 4. Invalid role
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 4: Invalid role${colors.reset}`);
    const res4 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Admin User',
        email: 'admin@test.org',
        password: 'AdminPassword123!',
        role: 'SUPER_ADMIN',
      }),
    });
    const data4 = await res4.json();

    assert(
      res4.status === 400 && data4.status === 'error' && data4.message.includes('Invalid role'),
      'Unsupported role returns HTTP 400',
      JSON.stringify(data4)
    );

    // ----------------------------------------------------------------
    // 5. Duplicate email
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 5: Duplicate email${colors.reset}`);
    const res5 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Duplicate John',
        email: 'john.volunteer@test.org',
        password: 'AnotherPassword123!',
        role: 'VOLUNTEER',
      }),
    });
    const data5 = await res5.json();

    assert(
      res5.status === 409 && data5.status === 'error' && data5.message === 'Email is already registered',
      'Duplicate email returns HTTP 409 Conflict',
      JSON.stringify(data5)
    );

    // ----------------------------------------------------------------
    // 6. Invalid input (short password, bad email, empty name)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 6: Invalid input${colors.reset}`);
    const res6a = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Short Pass',
        email: 'shortpass@test.org',
        password: '123',
        role: 'VOLUNTEER',
      }),
    });
    const data6a = await res6a.json();
    assert(
      res6a.status === 400 && data6a.message.includes('at least 8 characters'),
      'Short password (< 8 chars) returns HTTP 400',
      JSON.stringify(data6a)
    );

    const res6b = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Bad Email',
        email: 'not-a-valid-email',
        password: 'Password123!',
        role: 'VOLUNTEER',
      }),
    });
    const data6b = await res6b.json();
    assert(
      res6b.status === 400 && data6b.message.includes('valid email address'),
      'Invalid email format returns HTTP 400',
      JSON.stringify(data6b)
    );

    const res6c = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: '   ',
        email: 'emptyname@test.org',
        password: 'Password123!',
        role: 'VOLUNTEER',
      }),
    });
    const data6c = await res6c.json();
    assert(
      res6c.status === 400 && data6c.message.includes('Full name is required'),
      'Blank whitespace full_name returns HTTP 400',
      JSON.stringify(data6c)
    );

    // ----------------------------------------------------------------
    // 7. Verify password is stored as a hash
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 7: Verify password is stored as a hash${colors.reset}`);
    const dbUserRes = await pool.query(
      'SELECT password_hash FROM users WHERE email = $1',
      ['john.volunteer@test.org']
    );
    const storedHash = dbUserRes.rows[0]?.password_hash;
    const isBcryptHash = storedHash && storedHash.startsWith('$2') && storedHash.length === 60;
    const isNotPlaintext = storedHash !== 'SecretPassword123!';
    const passwordMatches = await bcrypt.compare('SecretPassword123!', storedHash || '');

    assert(
      isBcryptHash && isNotPlaintext,
      'Password in PostgreSQL is a 60-character bcrypt hash, not plain text',
      `Hash: ${storedHash}`
    );
    assert(
      passwordMatches,
      'Bcrypt hash verifies against the original plain-text password'
    );

    // ----------------------------------------------------------------
    // 8. Verify password/hash is NOT returned in API response
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 8: Verify password/hash is NOT returned in API response${colors.reset}`);
    const userObj1 = volunteerResponseData?.data?.user;
    const userObj2 = coordinatorResponseData?.data?.user;

    const noLeak1 = userObj1 && userObj1.password === undefined && userObj1.password_hash === undefined;
    const noLeak2 = userObj2 && userObj2.password === undefined && userObj2.password_hash === undefined;

    assert(
      noLeak1 && noLeak2,
      'Neither password nor password_hash is returned in API responses',
      `volunteer keys: ${Object.keys(userObj1 || {})}, coordinator keys: ${Object.keys(userObj2 || {})}`
    );

    // ----------------------------------------------------------------
    // 9. Verify user actually exists in PostgreSQL
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 9: Verify user actually exists in PostgreSQL${colors.reset}`);
    const dbCoordRes = await pool.query(
      'SELECT id, full_name, email, role, created_at, updated_at FROM users WHERE email = $1',
      ['sarah.coord@test.org']
    );
    const dbCoord = dbCoordRes.rows[0];

    assert(
      dbCoord &&
        dbCoord.full_name === 'Sarah Coordinator' &&
        dbCoord.role === 'COORDINATOR' &&
        dbCoord.id === userObj2?.id,
      'User is persisted in PostgreSQL with correct ID, role, and timestamps',
      JSON.stringify(dbCoord)
    );

    // ----------------------------------------------------------------
    // 10. Verify existing health APIs still work
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 10: Verify existing health APIs still work${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.service === 'api',
      'GET /api/health returns 200 { status: "ok", service: "api" }',
      JSON.stringify(healthData)
    );

    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthData = await dbHealthRes.json();
    assert(
      dbHealthRes.status === 200 && dbHealthData.status === 'ok' && dbHealthData.database === 'connected',
      'GET /api/health/db returns 200 { status: "ok", database: "connected" }',
      JSON.stringify(dbHealthData)
    );

  } catch (err) {
    console.error(`\n${colors.red}Unexpected error during tests:${colors.reset}`, err);
    failed++;
  } finally {
    // Clean up test users
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

    // Close server and database pool
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}TEST RESULTS: ${colors.green}${passed} Passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} Failed${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests();
