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
  console.log(`${colors.bold}${colors.cyan}=============================================================`);
  console.log(`  DAY 12: JWT AUTHENTICATION MIDDLEWARE TEST SUITE           `);
  console.log(`=============================================================${colors.reset}\n`);

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

  const testUser = {
    full_name: 'Protected Route Volunteer',
    email: 'protected.volunteer@test.org',
    password: 'VolunteerPass123!',
    role: 'VOLUNTEER',
  };

  const coordinatorUser = {
    full_name: 'Protected Route Coordinator',
    email: 'protected.coord@test.org',
    password: 'CoordinatorPass123!',
    role: 'COORDINATOR',
  };

  const testEmails = [testUser.email, coordinatorUser.email];

  // Clean up any leftover records
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

  try {
    // ----------------------------------------------------------------
    // Setup: Register and Login to obtain authentic tokens
    // ----------------------------------------------------------------
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordinatorUser),
    });

    const loginRes1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });
    const loginData1 = await loginRes1.json();
    const volunteerToken = loginData1.data?.token;
    const volunteerId = loginData1.data?.user?.id;

    const loginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: coordinatorUser.email,
        password: coordinatorUser.password,
      }),
    });
    const loginData2 = await loginRes2.json();
    const coordinatorToken = loginData2.data?.token;
    const coordinatorId = loginData2.data?.user?.id;

    // ----------------------------------------------------------------
    // 1. Valid JWT accesses /api/auth/me
    // ----------------------------------------------------------------
    console.log(`${colors.bold}Test 1: Valid JWT accesses /api/auth/me${colors.reset}`);
    const res1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const data1 = await res1.json();

    assert(
      res1.status === 200 && data1.status === 'success',
      'Valid JWT accesses /api/auth/me with HTTP 200',
      JSON.stringify(data1)
    );

    // ----------------------------------------------------------------
    // 2. Missing Authorization header
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 2: Missing Authorization header${colors.reset}`);
    const res2 = await fetch(`${baseUrl}/api/auth/me`);
    const data2 = await res2.json();

    assert(
      res2.status === 401 && data2.status === 'error' && data2.message.includes('Authorization header is required'),
      'Missing Authorization header returns HTTP 401 with descriptive message',
      JSON.stringify(data2)
    );

    // ----------------------------------------------------------------
    // 3. Missing Bearer token / malformed scheme
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 3: Missing Bearer token / malformed scheme${colors.reset}`);
    const res3a = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Basic someCredentials123' },
    });
    const data3a = await res3a.json();

    const res3b = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer ' },
    });
    const data3b = await res3b.json();

    assert(
      res3a.status === 401 && data3a.message.includes('Bearer scheme'),
      'Non-Bearer scheme returns HTTP 401',
      JSON.stringify(data3a)
    );
    assert(
      res3b.status === 401 && data3b.message.includes('Bearer scheme'),
      'Bearer with empty token returns HTTP 401',
      JSON.stringify(data3b)
    );

    // ----------------------------------------------------------------
    // 4. Invalid JWT
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 4: Invalid JWT${colors.reset}`);
    const res4 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer not.a.valid.jwt.string' },
    });
    const data4 = await res4.json();

    assert(
      res4.status === 401 && data4.status === 'error' && data4.message === 'Invalid token',
      'Malformed token string returns HTTP 401 "Invalid token"',
      JSON.stringify(data4)
    );

    // ----------------------------------------------------------------
    // 5. Tampered JWT (modified payload)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 5: Tampered JWT${colors.reset}`);
    const parts = volunteerToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ id: volunteerId, role: 'SUPER_ADMIN' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res5 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    const data5 = await res5.json();

    assert(
      res5.status === 401 && data5.status === 'error' && data5.message === 'Invalid token',
      'Tampered token fails signature verification and returns HTTP 401',
      JSON.stringify(data5)
    );

    // ----------------------------------------------------------------
    // 6. Expired JWT
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 6: Expired JWT${colors.reset}`);
    const expiredToken = jwt.sign(
      { id: volunteerId, role: 'VOLUNTEER' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res6 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    const data6 = await res6.json();

    assert(
      res6.status === 401 && data6.status === 'error' && data6.message === 'Token has expired',
      'Expired token returns HTTP 401 "Token has expired"',
      JSON.stringify(data6)
    );

    // ----------------------------------------------------------------
    // 7. Wrong/mismatched signature (signed with different secret)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 7: Wrong/mismatched signature${colors.reset}`);
    const foreignSecretToken = jwt.sign(
      { id: volunteerId, role: 'VOLUNTEER' },
      'completely_different_foreign_secret_123',
      { expiresIn: '1h' }
    );

    const res7 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${foreignSecretToken}` },
    });
    const data7 = await res7.json();

    assert(
      res7.status === 401 && data7.status === 'error' && data7.message === 'Invalid token',
      'Token signed with mismatched secret returns HTTP 401 "Invalid token"',
      JSON.stringify(data7)
    );

    // ----------------------------------------------------------------
    // 8. Valid token exposes correct user id
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 8: Valid token exposes correct user id${colors.reset}`);
    assert(
      data1.data?.user?.id === volunteerId &&
      data1.data?.user?.full_name === testUser.full_name &&
      data1.data?.user?.email === testUser.email,
      'Protected route exposes expected user id, full_name, and email from database',
      `Expected: ${volunteerId}, Received: ${data1.data?.user?.id}`
    );

    // ----------------------------------------------------------------
    // 9. Valid token exposes correct role
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 9: Valid token exposes correct role${colors.reset}`);
    const coordMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const coordMeData = await coordMeRes.json();

    assert(
      data1.data?.user?.role === 'VOLUNTEER',
      'Volunteer token exposes role VOLUNTEER'
    );
    assert(
      coordMeData.data?.user?.role === 'COORDINATOR' && coordMeData.data?.user?.id === coordinatorId,
      'Coordinator token exposes role COORDINATOR and matching id'
    );

    // ----------------------------------------------------------------
    // 10. req.user does not contain password
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 10: req.user does not contain password${colors.reset}`);
    assert(
      data1.data?.user?.password === undefined && coordMeData.data?.user?.password === undefined,
      'req.user does not contain raw password'
    );

    // ----------------------------------------------------------------
    // 11. req.user does not contain password_hash
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 11: req.user does not contain password_hash${colors.reset}`);
    assert(
      data1.data?.user?.password_hash === undefined && coordMeData.data?.user?.password_hash === undefined,
      'req.user does not contain password_hash'
    );

    // ----------------------------------------------------------------
    // 12. Existing registration tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 12: Existing registration tests still pass${colors.reset}`);
    const regCheckRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Regression User',
        email: 'regression.check@test.org',
        password: 'RegressionPass123!',
        role: 'VOLUNTEER',
      }),
    });
    const regCheckData = await regCheckRes.json();
    assert(
      regCheckRes.status === 201 && regCheckData.status === 'success',
      'Registration API remains operational (HTTP 201)'
    );
    testEmails.push('regression.check@test.org');

    // ----------------------------------------------------------------
    // 13. Existing login tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 13: Existing login tests still pass${colors.reset}`);
    const loginCheckRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'regression.check@test.org',
        password: 'RegressionPass123!',
      }),
    });
    const loginCheckData = await loginCheckRes.json();
    assert(
      loginCheckRes.status === 200 && loginCheckData.data?.token !== undefined,
      'Login API remains operational (HTTP 200 with token)'
    );

    // ----------------------------------------------------------------
    // 14. Existing /api/health still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 14: Existing /api/health still works${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.service === 'api',
      'GET /api/health returns 200 { status: "ok", service: "api" }'
    );

    // ----------------------------------------------------------------
    // 15. Existing /api/health/db still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 15: Existing /api/health/db still works${colors.reset}`);
    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthData = await dbHealthRes.json();
    assert(
      dbHealthRes.status === 200 && dbHealthData.status === 'ok' && dbHealthData.database === 'connected',
      'GET /api/health/db returns 200 { status: "ok", database: "connected" }'
    );

  } catch (err) {
    console.error(`\n${colors.red}Unexpected error during tests:${colors.reset}`, err);
    failed++;
  } finally {
    // Clean up test records
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

    // Close server and database pool
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  }

  // Summary
  console.log(`\n${colors.bold}${colors.cyan}=============================================================`);
  console.log(`TEST RESULTS: ${colors.green}${passed} Passed${colors.reset}, ${failed > 0 ? colors.red : colors.green}${failed} Failed${colors.reset}`);
  console.log(`=============================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests();
