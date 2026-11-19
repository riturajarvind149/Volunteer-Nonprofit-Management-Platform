require('dotenv').config();
const app = require('../src/app');
const fetch = require('./helpers/testFetch');
const pool = require('../src/config/db');

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
  console.log(`  DAY 15: ORGANIZATION MANAGEMENT FOUNDATION TEST SUITE       `);
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

  const testCoordinator = {
    full_name: 'Org Test Coordinator',
    email: 'org.coordinator@test.org',
    password: 'CoordPassword123!',
    role: 'COORDINATOR',
  };

  const testVolunteer = {
    full_name: 'Org Test Volunteer',
    email: 'org.volunteer@test.org',
    password: 'VolPassword123!',
    role: 'VOLUNTEER',
  };

  const secondCoordinator = { full_name: 'Second Org Coordinator', email: 'org.coordinator2@test.org', password: 'Password123!', role: 'COORDINATOR' };
  const testEmails = [testCoordinator.email, testVolunteer.email, secondCoordinator.email];

  // Clean up any leftover test data
  await pool.query(
    `DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1)))`,
    [testEmails]
  );
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [testEmails]);

  let coordinatorToken;
  let coordinatorId;
  let volunteerToken;
  let createdOrgId;

  try {
    // ----------------------------------------------------------------
    // Setup: Register and Login users
    // ----------------------------------------------------------------
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCoordinator),
    });

    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testVolunteer),
    });

    const loginResCoord = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCoordinator.email,
        password: testCoordinator.password,
      }),
    });
    const loginDataCoord = await loginResCoord.json();
    coordinatorToken = loginDataCoord.data?.token;
    coordinatorId = loginDataCoord.data?.user?.id;

    const loginResVol = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testVolunteer.email,
        password: testVolunteer.password,
      }),
    });
    const loginDataVol = await loginResVol.json();
    volunteerToken = loginDataVol.data?.token;

    // ----------------------------------------------------------------
    // Test 1: Coordinator creates organization -> 201 Created
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 1: Coordinator creates organization${colors.reset}`);
    const res1 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`,
      },
      body: JSON.stringify({
        name: 'Community Food Rescue',
        description: 'Distributing excess food to families in need.',
      }),
    });
    const data1 = await res1.json();
    createdOrgId = data1.data?.organization?.id;
    assert(
      res1.status === 201 &&
      data1.status === 'success' &&
      data1.data?.organization?.name === 'Community Food Rescue',
      'POST /api/organizations by COORDINATOR returns HTTP 201 with created organization',
      `Status: ${res1.status}, Body: ${JSON.stringify(data1)}`
    );

    // ----------------------------------------------------------------
    // Test 2: The creator becomes the organization's owner
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 2: The creator becomes the organization's owner${colors.reset}`);
    assert(
      data1.data?.organization?.my_role === 'OWNER' &&
        (await pool.query(
          "SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'",
          [data1.data.organization.id]
        )).rows[0]?.user_id === coordinatorId,
      'The authenticated user is stored as the organization owner (my_role OWNER)',
      `my_role: ${data1.data?.organization?.my_role}`
    );

    // ----------------------------------------------------------------
    // Test 3: Volunteer cannot create organization -> 403 Forbidden
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 3: Volunteer cannot create organization${colors.reset}`);
    const res3 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volunteerToken}`,
      },
      body: JSON.stringify({
        name: 'Volunteer Fake NGO',
        description: 'Should not be allowed.',
      }),
    });
    const data3 = await res3.json();
    assert(
      res3.status === 403 &&
      data3.status === 'error' &&
      data3.message.toLowerCase().includes('forbidden'),
      'POST /api/organizations by VOLUNTEER returns HTTP 403 Forbidden',
      `Status: ${res3.status}, Body: ${JSON.stringify(data3)}`
    );

    // ----------------------------------------------------------------
    // Test 4: Missing authentication -> 401 Unauthorized
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 4: Missing authentication to create organization${colors.reset}`);
    const res4 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthenticated NGO',
      }),
    });
    const data4 = await res4.json();
    assert(
      res4.status === 401 && data4.status === 'error',
      'POST /api/organizations without token returns HTTP 401 Unauthorized',
      `Status: ${res4.status}`
    );

    // ----------------------------------------------------------------
    // Test 5: Missing name -> 400 Bad Request
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 5: Missing organization name${colors.reset}`);
    const res5 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`,
      },
      body: JSON.stringify({
        description: 'Missing name field',
      }),
    });
    const data5 = await res5.json();
    assert(
      res5.status === 400 &&
      data5.status === 'error' &&
      data5.message.toLowerCase().includes('ngo name'),
      'Missing name returns HTTP 400 Bad Request',
      `Status: ${res5.status}, Message: ${data5.message}`
    );

    // ----------------------------------------------------------------
    // Test 6: Invalid name (too short or blank whitespace) -> 400 Bad Request
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 6: Invalid organization name (blank or single char)${colors.reset}`);
    const res6a = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`,
      },
      body: JSON.stringify({ name: '   ' }),
    });

    const res6b = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`,
      },
      body: JSON.stringify({ name: 'A' }),
    });

    assert(
      res6a.status === 400 && res6b.status === 400,
      'Blank whitespace or single-character name returns HTTP 400 Bad Request',
      `Blank status: ${res6a.status}, Single char status: ${res6b.status}`
    );

    // ----------------------------------------------------------------
    // Test 7: Invalid description (wrong type / too long) -> 400 Bad Request
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 7: Invalid description${colors.reset}`);
    const res7a = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`,
      },
      body: JSON.stringify({
        name: 'Valid Name NGO',
        description: 12345, // Not a string
      }),
    });

    const res7b = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordinatorToken}`,
      },
      body: JSON.stringify({
        name: 'Valid Name NGO',
        description: 'X'.repeat(2001), // Exceeds 2000 chars
      }),
    });

    assert(
      res7a.status === 400 && res7b.status === 400,
      'Non-string or overly long (>2000 chars) description returns HTTP 400 Bad Request',
      `Non-string status: ${res7a.status}, Overly long status: ${res7b.status}`
    );

    // ----------------------------------------------------------------
    // Test 8: Organization appears in GET /api/organizations
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 8: Organization appears in GET /api/organizations${colors.reset}`);
    const res8 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data8 = await res8.json();
    const foundOrg = data8.data?.organizations?.find((o) => o.id === createdOrgId);
    assert(
      res8.status === 200 &&
      Array.isArray(data8.data?.organizations) &&
      Boolean(foundOrg),
      'Created organization is present in GET /api/organizations list',
      `Found: ${Boolean(foundOrg)}`
    );

    // ----------------------------------------------------------------
    // Test 9: Authenticated Volunteer can list organizations -> 200 OK
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 9: Authenticated Volunteer can list organizations${colors.reset}`);
    const res9 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const data9 = await res9.json();
    assert(
      res9.status === 200 &&
      data9.status === 'success' &&
      Array.isArray(data9.data?.organizations),
      'VOLUNTEER -> GET /api/organizations returns HTTP 200 OK with organizations array',
      `Status: ${res9.status}`
    );

    // ----------------------------------------------------------------
    // Test 10: Authenticated Coordinator can list organizations -> 200 OK
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 10: Authenticated Coordinator can list organizations${colors.reset}`);
    const res10 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data10 = await res10.json();
    assert(
      res10.status === 200 &&
      data10.status === 'success' &&
      Array.isArray(data10.data?.organizations),
      'COORDINATOR -> GET /api/organizations returns HTTP 200 OK with organizations array',
      `Status: ${res10.status}`
    );

    // ----------------------------------------------------------------
    // Test 11: GET /api/organizations/:id returns correct organization -> 200 OK
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 11: GET /api/organizations/:id returns correct organization${colors.reset}`);
    const res11 = await fetch(`${baseUrl}/api/organizations/${createdOrgId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const data11 = await res11.json();
    assert(
      res11.status === 200 &&
      data11.status === 'success' &&
      data11.data?.organization?.id === createdOrgId &&
      data11.data?.organization?.my_role === null,
      'GET /api/organizations/:id returns HTTP 200 with full organization profile (a volunteer has no role in it)',
      `Status: ${res11.status}, ID: ${data11.data?.organization?.id}`
    );

    // ----------------------------------------------------------------
    // Test 12: Unknown organization -> 404 Not Found
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 12: Unknown organization returns 404${colors.reset}`);
    const nonExistentUUID = '00000000-0000-4000-a000-000000000000';
    const res12 = await fetch(`${baseUrl}/api/organizations/${nonExistentUUID}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data12 = await res12.json();
    assert(
      res12.status === 404 &&
      data12.status === 'error' &&
      data12.message.toLowerCase().includes('not found'),
      'Non-existent UUID returns HTTP 404 "Organization not found"',
      `Status: ${res12.status}, Message: ${data12.message}`
    );

    // ----------------------------------------------------------------
    // Test 13: Invalid organization ID format -> 400 Bad Request
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 13: Invalid organization ID format returns 400${colors.reset}`);
    const res13 = await fetch(`${baseUrl}/api/organizations/not-a-valid-uuid-123`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const data13 = await res13.json();
    assert(
      res13.status === 400 &&
      data13.status === 'error' &&
      data13.message.toLowerCase().includes('uuid'),
      'Malformed organization ID returns HTTP 400 Bad Request',
      `Status: ${res13.status}, Message: ${data13.message}`
    );

    // ----------------------------------------------------------------
    // Test 14: One NGO per account; coordinator_id cannot be overridden by request body
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 14: One NGO per account, and coordinator_id cannot be overridden${colors.reset}`);
    const secondNgo = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${coordinatorToken}` },
      body: JSON.stringify({ name: 'A Second NGO', registration_type: 'TRUST', city: 'Pune' }),
    });
    const secondNgoData = await secondNgo.json();
    assert(
      secondNgo.status === 409 && secondNgoData.code === 'ALREADY_OWNS_ORGANIZATION',
      'A coordinator who already runs an NGO cannot register a second one (409)',
      `Status: ${secondNgo.status}, Code: ${secondNgoData.code}`
    );

    // A coordinator without an NGO registers one while trying to spoof the owner.
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secondCoordinator),
    });
    const secondLogin = await (await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: secondCoordinator.email, password: secondCoordinator.password }),
    })).json();
    const secondCoordinatorId = secondLogin.data?.user?.id;
    const maliciousCoordinatorId = '11111111-1111-4111-a111-111111111111';
    const res14 = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secondLogin.data?.token}`,
      },
      body: JSON.stringify({
        name: 'Spoofed Ownership NGO',
        description: 'Attempting to inject a fake coordinator_id in request body.',
        coordinator_id: maliciousCoordinatorId,
      }),
    });
    const data14 = await res14.json();
    assert(
      res14.status === 201 &&
      data14.data?.organization?.my_role === 'OWNER' &&
      (await pool.query(
        "SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'",
        [data14.data.organization.id]
      )).rows[0]?.user_id === secondCoordinatorId,
      'Backend ignores coordinator_id from request body; the authenticated user becomes the owner',
      `Attempted owner: ${maliciousCoordinatorId}`
    );

    // ----------------------------------------------------------------
    // Test 15: Existing registration tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 15: Registration API still operational${colors.reset}`);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Regression Org User',
        email: 'reg.org.user@test.org',
        password: 'Password123!',
        role: 'VOLUNTEER',
      }),
    });
    const regData = await regRes.json();
    assert(
      regRes.status === 201 && regData.status === 'success',
      'POST /api/auth/register returns HTTP 201',
      `Status: ${regRes.status}`
    );
    await pool.query('DELETE FROM users WHERE email = $1', ['reg.org.user@test.org']);

    // ----------------------------------------------------------------
    // Test 16: Existing login tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 16: Login API still operational${colors.reset}`);
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testCoordinator.email,
        password: testCoordinator.password,
      }),
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && Boolean(loginData.data?.token),
      'POST /api/auth/login returns HTTP 200 with token',
      `Status: ${loginRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 17: Existing JWT middleware tests still pass (/api/auth/me)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 17: GET /api/auth/me still operational${colors.reset}`);
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.data?.user?.email === testCoordinator.email,
      'GET /api/auth/me returns HTTP 200 with authenticated profile',
      `Status: ${meRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 18: Role-based authorization (coordinator-only route)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 18: Role-based authorization still operational${colors.reset}`);
    const rbacCoordRes = await fetch(`${baseUrl}/api/organizations/mine`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const rbacVolRes = await fetch(`${baseUrl}/api/organizations/mine`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    assert(
      rbacCoordRes.status === 200 && rbacVolRes.status === 403,
      'RBAC endpoints still enforce 200 for matching role and 403 for non-matching role',
      `Coord: ${rbacCoordRes.status}, Vol: ${rbacVolRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 19: Health endpoint still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 19: GET /api/health still operational${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.service === 'api',
      'GET /api/health returns HTTP 200 { status: "ok", service: "api" }',
      `Status: ${healthRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 20: Database health endpoint still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 20: GET /api/health/db still operational${colors.reset}`);
    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthData = await dbHealthRes.json();
    assert(
      dbHealthRes.status === 200 && dbHealthData.status === 'ok' && dbHealthData.database === 'connected',
      'GET /api/health/db returns HTTP 200 { status: "ok", database: "connected" }',
      `Status: ${dbHealthRes.status}`
    );

  } catch (err) {
    console.error(`\n${colors.red}Unexpected error during tests:${colors.reset}`, err);
    failed++;
  } finally {
    // Clean up test data
    await pool.query(
      `DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1)))`,
      [testEmails]
    );
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
