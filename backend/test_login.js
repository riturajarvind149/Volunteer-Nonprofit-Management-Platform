require('dotenv').config();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
  console.log(`${colors.bold}${colors.cyan}  DAY 11: USER LOGIN & JWT AUTHENTICATION TEST SUITE ${colors.reset}`);
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

  const testUsers = [
    {
      full_name: 'Volunteer User',
      email: 'volunteer.login@test.org',
      rawPassword: 'VolunteerPass123!',
      role: 'VOLUNTEER',
    },
    {
      full_name: 'Coordinator User',
      email: 'coordinator.login@test.org',
      rawPassword: 'CoordinatorPass123!',
      role: 'COORDINATOR',
    },
    {
      full_name: 'Register Test User',
      email: 'reg.test@test.org',
      rawPassword: 'RegisterPass123!',
      role: 'VOLUNTEER',
    },
  ];

  const testEmails = testUsers.map((u) => u.email);

  // Clean up any leftover test records before starting
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

  // Seed volunteer and coordinator for testing login
  for (const user of [testUsers[0], testUsers[1]]) {
    const hash = await bcrypt.hash(user.rawPassword, 10);
    await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [user.full_name, user.email, hash, user.role]
    );
  }

  let volunteerLoginResponse = null;
  let coordinatorLoginResponse = null;

  try {
    // ----------------------------------------------------------------
    // 1. Valid volunteer login
    // ----------------------------------------------------------------
    console.log(`${colors.bold}Test 1: Valid volunteer login${colors.reset}`);
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'volunteer.login@test.org',
        password: 'VolunteerPass123!',
      }),
    });
    const data1 = await res1.json();
    volunteerLoginResponse = data1;

    assert(
      res1.status === 200 && data1.status === 'success' && data1.data?.user?.role === 'VOLUNTEER',
      'Volunteer login returns HTTP 200 with role VOLUNTEER',
      JSON.stringify(data1)
    );
    assert(
      data1.data?.user?.email === 'volunteer.login@test.org' && data1.data?.token,
      'Volunteer login returns token and correct user profile'
    );

    // ----------------------------------------------------------------
    // 2. Valid coordinator login
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 2: Valid coordinator login${colors.reset}`);
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'coordinator.login@test.org',
        password: 'CoordinatorPass123!',
      }),
    });
    const data2 = await res2.json();
    coordinatorLoginResponse = data2;

    assert(
      res2.status === 200 && data2.status === 'success' && data2.data?.user?.role === 'COORDINATOR',
      'Coordinator login returns HTTP 200 with role COORDINATOR',
      JSON.stringify(data2)
    );
    assert(
      data2.data?.user?.email === 'coordinator.login@test.org' && data2.data?.token,
      'Coordinator login returns token and correct user profile'
    );

    // ----------------------------------------------------------------
    // 3. Missing email
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 3: Missing email${colors.reset}`);
    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'SomePassword123!',
      }),
    });
    const data3 = await res3.json();

    assert(
      res3.status === 400 && data3.status === 'error' && data3.message.includes('Email is required'),
      'Missing email returns HTTP 400 with descriptive message',
      JSON.stringify(data3)
    );

    // ----------------------------------------------------------------
    // 4. Missing password
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 4: Missing password${colors.reset}`);
    const res4 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'volunteer.login@test.org',
      }),
    });
    const data4 = await res4.json();

    assert(
      res4.status === 400 && data4.status === 'error' && data4.message.includes('Password is required'),
      'Missing password returns HTTP 400 with descriptive message',
      JSON.stringify(data4)
    );

    // ----------------------------------------------------------------
    // 5. Invalid email format
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 5: Invalid email format${colors.reset}`);
    const res5 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-a-valid-email',
        password: 'Password123!',
      }),
    });
    const data5 = await res5.json();

    assert(
      res5.status === 400 && data5.status === 'error' && data5.message.includes('valid email address'),
      'Invalid email format returns HTTP 400 with descriptive message',
      JSON.stringify(data5)
    );

    // ----------------------------------------------------------------
    // 6. Non-existent email (Generic error message)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 6: Non-existent email${colors.reset}`);
    const res6 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ghost.user@test.org',
        password: 'Password123!',
      }),
    });
    const data6 = await res6.json();

    assert(
      res6.status === 401 && data6.status === 'error' && data6.message === 'Invalid email or password',
      'Non-existent email returns HTTP 401 with generic "Invalid email or password"',
      JSON.stringify(data6)
    );

    // ----------------------------------------------------------------
    // 7. Incorrect password (Identical generic error message)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 7: Incorrect password${colors.reset}`);
    const res7 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'volunteer.login@test.org',
        password: 'WrongPassword999!',
      }),
    });
    const data7 = await res7.json();

    assert(
      res7.status === 401 && data7.status === 'error' && data7.message === 'Invalid email or password',
      'Incorrect password returns identical HTTP 401 generic message',
      JSON.stringify(data7)
    );

    // ----------------------------------------------------------------
    // 8. Verify successful response contains JWT
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 8: Verify successful response contains JWT${colors.reset}`);
    const token = volunteerLoginResponse?.data?.token;
    const isJwtFormat = typeof token === 'string' && token.split('.').length === 3;

    assert(
      isJwtFormat,
      'Response contains a well-formed 3-part JWT token string (header.payload.signature)',
      `Token preview: ${token ? token.substring(0, 25) + '...' : 'undefined'}`
    );

    // ----------------------------------------------------------------
    // 9. Verify response does NOT contain password/password_hash
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 9: Verify response does NOT contain password/password_hash${colors.reset}`);
    const user1 = volunteerLoginResponse?.data?.user;
    const user2 = coordinatorLoginResponse?.data?.user;

    const noLeak1 = user1 && user1.password === undefined && user1.password_hash === undefined;
    const noLeak2 = user2 && user2.password === undefined && user2.password_hash === undefined;

    assert(
      noLeak1 && noLeak2,
      'Neither password nor password_hash is returned in login responses',
      `volunteer keys: ${Object.keys(user1 || {})}, coordinator keys: ${Object.keys(user2 || {})}`
    );

    // ----------------------------------------------------------------
    // 10. Verify JWT can be decoded and contains only intended non-sensitive claims
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 10: Verify JWT claims and decoding${colors.reset}`);
    const decodedVolunteer = jwt.verify(token, process.env.JWT_SECRET);

    const hasExpectedClaims =
      decodedVolunteer.id === user1?.id &&
      decodedVolunteer.role === 'VOLUNTEER' &&
      typeof decodedVolunteer.iat === 'number' &&
      typeof decodedVolunteer.exp === 'number';

    const hasNoSensitiveClaims =
      decodedVolunteer.password === undefined &&
      decodedVolunteer.password_hash === undefined &&
      decodedVolunteer.email === undefined; // Email not needed in token

    assert(
      hasExpectedClaims && hasNoSensitiveClaims,
      'JWT decodes successfully and contains only { id, role, iat, exp }',
      JSON.stringify(decodedVolunteer)
    );

    // ----------------------------------------------------------------
    // 11. Verify expired/invalid/tampered token behavior
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 11: Verify invalid/tampered token rejection${colors.reset}`);
    let invalidTokenCaught = false;
    try {
      jwt.verify(token, 'wrong_secret_key_tampered');
    } catch (err) {
      invalidTokenCaught = err.name === 'JsonWebTokenError';
    }

    let tamperedTokenCaught = false;
    try {
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignaturexyz`;
      jwt.verify(tamperedToken, process.env.JWT_SECRET);
    } catch (err) {
      tamperedTokenCaught = err.name === 'JsonWebTokenError';
    }

    assert(
      invalidTokenCaught && tamperedTokenCaught,
      'Invalid secret or tampered signature is rejected by JWT verification'
    );

    // ----------------------------------------------------------------
    // 12. Verify existing registration flow still passes
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 12: Verify existing registration flow${colors.reset}`);
    const resReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Register Test User',
        email: 'reg.test@test.org',
        password: 'RegisterPass123!',
        role: 'VOLUNTEER',
      }),
    });
    const dataReg = await resReg.json();

    assert(
      resReg.status === 201 && dataReg.status === 'success' && dataReg.data?.user?.email === 'reg.test@test.org',
      'Registration API remains functional (returns 201 with created user)',
      JSON.stringify(dataReg)
    );

    // ----------------------------------------------------------------
    // 13. Verify /api/health still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 13: Verify /api/health still works${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.service === 'api',
      'GET /api/health returns 200 { status: "ok", service: "api" }',
      JSON.stringify(healthData)
    );

    // ----------------------------------------------------------------
    // 14. Verify /api/health/db still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 14: Verify /api/health/db still works${colors.reset}`);
    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthData = await dbHealthRes.json();
    assert(
      dbHealthRes.status === 200 && dbHealthData.status === 'ok' && dbHealthData.database === 'connected',
      'GET /api/health/db returns 200 { status: "ok", database: "connected" }',
      JSON.stringify(dbHealthData)
    );

  } catch (err) {
    console.error(`\n${colors.red}Unexpected error during test execution:${colors.reset}`, err);
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
