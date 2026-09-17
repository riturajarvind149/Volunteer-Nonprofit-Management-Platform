require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const pool = require('./src/config/db');
const authorizeRoles = require('./src/middleware/authorizeRoles');

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
  console.log(`  DAY 14: ROLE-BASED AUTHORIZATION (RBAC) TEST SUITE         `);
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

  const testVolunteer = {
    full_name: 'RBAC Test Volunteer',
    email: 'rbac.volunteer@test.org',
    password: 'VolunteerPass123!',
    role: 'VOLUNTEER',
  };

  const testCoordinator = {
    full_name: 'RBAC Test Coordinator',
    email: 'rbac.coordinator@test.org',
    password: 'CoordinatorPass123!',
    role: 'COORDINATOR',
  };

  const testEmails = [testVolunteer.email, testCoordinator.email];

  // Clean up any leftover records
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

  try {
    // ----------------------------------------------------------------
    // Setup: Register and Login users to acquire authentic signed JWTs
    // ----------------------------------------------------------------
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testVolunteer),
    });

    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCoordinator),
    });

    const loginResVol = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testVolunteer.email,
        password: testVolunteer.password,
      }),
    });
    const loginDataVol = await loginResVol.json();
    const volunteerToken = loginDataVol.data?.token;

    const loginResCoord = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCoordinator.email,
        password: testCoordinator.password,
      }),
    });
    const loginDataCoord = await loginResCoord.json();
    const coordinatorToken = loginDataCoord.data?.token;

    // ----------------------------------------------------------------
    // Test 1: Coordinator accessing coordinator endpoint -> 200 OK
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 1: Coordinator accesses coordinator endpoint${colors.reset}`);
    const res1 = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data1 = await res1.json();
    assert(
      res1.status === 200 &&
      data1.status === 'success' &&
      data1.data?.user?.role === 'COORDINATOR',
      'COORDINATOR -> GET /api/auth/coordinator-test returns HTTP 200 OK',
      `Status: ${res1.status}, Body: ${JSON.stringify(data1)}`
    );

    // ----------------------------------------------------------------
    // Test 2: Volunteer accessing coordinator endpoint -> 403 Forbidden
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 2: Volunteer accesses coordinator endpoint${colors.reset}`);
    const res2 = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const data2 = await res2.json();
    assert(
      res2.status === 403 &&
      data2.status === 'error' &&
      typeof data2.message === 'string' &&
      data2.message.toLowerCase().includes('forbidden'),
      'VOLUNTEER -> GET /api/auth/coordinator-test returns HTTP 403 Forbidden',
      `Status: ${res2.status}, Body: ${JSON.stringify(data2)}`
    );

    // ----------------------------------------------------------------
    // Test 3: Volunteer accessing volunteer endpoint -> 200 OK
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 3: Volunteer accesses volunteer endpoint${colors.reset}`);
    const res3 = await fetch(`${baseUrl}/api/auth/volunteer-test`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const data3 = await res3.json();
    assert(
      res3.status === 200 &&
      data3.status === 'success' &&
      data3.data?.user?.role === 'VOLUNTEER',
      'VOLUNTEER -> GET /api/auth/volunteer-test returns HTTP 200 OK',
      `Status: ${res3.status}, Body: ${JSON.stringify(data3)}`
    );

    // ----------------------------------------------------------------
    // Test 4: Coordinator accessing volunteer endpoint -> 403 Forbidden
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 4: Coordinator accesses volunteer endpoint${colors.reset}`);
    const res4 = await fetch(`${baseUrl}/api/auth/volunteer-test`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data4 = await res4.json();
    assert(
      res4.status === 403 &&
      data4.status === 'error' &&
      typeof data4.message === 'string' &&
      data4.message.toLowerCase().includes('forbidden'),
      'COORDINATOR -> GET /api/auth/volunteer-test returns HTTP 403 Forbidden',
      `Status: ${res4.status}, Body: ${JSON.stringify(data4)}`
    );

    // ----------------------------------------------------------------
    // Test 5: Missing JWT -> 401 Unauthorized
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 5: Missing JWT to protected endpoint${colors.reset}`);
    const res5 = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      method: 'GET',
    });
    const data5 = await res5.json();
    assert(
      res5.status === 401 &&
      data5.status === 'error',
      'Missing JWT returns HTTP 401 Unauthorized',
      `Status: ${res5.status}, Body: ${JSON.stringify(data5)}`
    );

    // ----------------------------------------------------------------
    // Test 6: Invalid JWT -> 401 Unauthorized
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 6: Invalid JWT${colors.reset}`);
    const res6 = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      method: 'GET',
      headers: { Authorization: 'Bearer this.is.invalid' },
    });
    const data6 = await res6.json();
    assert(
      res6.status === 401 &&
      data6.status === 'error' &&
      data6.message === 'Invalid token',
      'Invalid JWT returns HTTP 401 "Invalid token"',
      `Status: ${res6.status}, Body: ${JSON.stringify(data6)}`
    );

    // ----------------------------------------------------------------
    // Test 7: Tampered JWT -> 401 Unauthorized
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 7: Tampered JWT signature${colors.reset}`);
    const tokenParts = volunteerToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 999, role: 'COORDINATOR' })).toString('base64url');
    const tamperedToken = `${tokenParts[0]}.${tamperedPayload}.${tokenParts[2]}`;

    const res7 = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    const data7 = await res7.json();
    assert(
      res7.status === 401 &&
      data7.status === 'error',
      'Tampered JWT fails cryptographic verification and returns HTTP 401',
      `Status: ${res7.status}, Body: ${JSON.stringify(data7)}`
    );

    // ----------------------------------------------------------------
    // Test 8: /api/auth/me still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 8: /api/auth/me still operational${colors.reset}`);
    const res8 = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const data8 = await res8.json();
    assert(
      res8.status === 200 &&
      data8.status === 'success' &&
      data8.data?.user?.email === testVolunteer.email &&
      data8.data?.user?.role === 'VOLUNTEER',
      'GET /api/auth/me returns HTTP 200 with authenticated user profile',
      `Status: ${res8.status}, Body: ${JSON.stringify(data8)}`
    );

    // ----------------------------------------------------------------
    // Test 9: Registration still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 9: Registration API still functional${colors.reset}`);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Regression Check User',
        email: 'rbac.regression@test.org',
        password: 'RegressionPass123!',
        role: 'VOLUNTEER',
      }),
    });
    const regData = await regRes.json();
    assert(
      regRes.status === 201 &&
      regData.status === 'success' &&
      regData.data?.user?.role === 'VOLUNTEER',
      'POST /api/auth/register returns HTTP 201 with created user',
      `Status: ${regRes.status}, Body: ${JSON.stringify(regData)}`
    );
    // Cleanup regression user
    await pool.query('DELETE FROM users WHERE email = $1', ['rbac.regression@test.org']);

    // ----------------------------------------------------------------
    // Test 10: Login still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 10: Login API still functional${colors.reset}`);
    const loginCheckRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCoordinator.email,
        password: testCoordinator.password,
      }),
    });
    const loginCheckData = await loginCheckRes.json();
    assert(
      loginCheckRes.status === 200 &&
      loginCheckData.status === 'success' &&
      typeof loginCheckData.data?.token === 'string',
      'POST /api/auth/login returns HTTP 200 with valid token',
      `Status: ${loginCheckRes.status}, Body: ${JSON.stringify(loginCheckData)}`
    );

    // ----------------------------------------------------------------
    // Test 11: /api/health still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 11: /api/health still functional${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 &&
      healthData.status === 'ok' &&
      healthData.service === 'api',
      'GET /api/health returns HTTP 200 { status: "ok", service: "api" }',
      `Status: ${healthRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 12: /api/health/db still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 12: /api/health/db still functional${colors.reset}`);
    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthData = await dbHealthRes.json();
    assert(
      dbHealthRes.status === 200 &&
      dbHealthData.status === 'ok' &&
      dbHealthData.database === 'connected',
      'GET /api/health/db returns HTTP 200 { status: "ok", database: "connected" }',
      `Status: ${dbHealthRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 13: Unit tests on authorizeRoles middleware safety & flexibility
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 13: Unit tests on authorizeRoles safety & multi-role${colors.reset}`);

    // Missing req.user safely rejected
    let nextCalledWithError = null;
    const missingUserMiddleware = authorizeRoles('COORDINATOR');
    missingUserMiddleware({}, {}, (err) => {
      nextCalledWithError = err;
    });
    assert(
      nextCalledWithError &&
      nextCalledWithError.statusCode === 403,
      'authorizeRoles safely rejects requests without req.user with 403 AppError',
      `Error received: ${nextCalledWithError}`
    );

    // Multi-role middleware allows multiple roles
    let nextCalledVol = false;
    let nextCalledCoord = false;
    const multiRoleMiddleware = authorizeRoles('VOLUNTEER', 'COORDINATOR');
    multiRoleMiddleware({ user: { id: 1, role: 'VOLUNTEER' } }, {}, (err) => {
      if (!err) nextCalledVol = true;
    });
    multiRoleMiddleware({ user: { id: 2, role: 'COORDINATOR' } }, {}, (err) => {
      if (!err) nextCalledCoord = true;
    });
    assert(
      nextCalledVol && nextCalledCoord,
      'authorizeRoles correctly accepts multiple role arguments and passes authorized requests',
      `Vol passed: ${nextCalledVol}, Coord passed: ${nextCalledCoord}`
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
