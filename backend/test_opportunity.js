require('dotenv').config();
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
  console.log(`  DAY 16: OPPORTUNITY MANAGEMENT FOUNDATION TEST SUITE       `);
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

  // Start test server on ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  const coord1 = {
    full_name: 'Opportunity Coord One',
    email: 'opp.coord1@test.org',
    password: 'Coord1Password123!',
    role: 'COORDINATOR',
  };

  const coord2 = {
    full_name: 'Opportunity Coord Two',
    email: 'opp.coord2@test.org',
    password: 'Coord2Password123!',
    role: 'COORDINATOR',
  };

  const volunteer = {
    full_name: 'Opportunity Volunteer',
    email: 'opp.volunteer@test.org',
    password: 'VolPassword123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [coord1.email, coord2.email, volunteer.email];

  const cleanupDatabase = async () => {
    await pool.query(
      `DELETE FROM opportunities WHERE organization_id IN (
         SELECT id FROM organizations WHERE coordinator_id IN (
           SELECT id FROM users WHERE email = ANY($1)
         )
       )`,
      [testEmails]
    );
    await pool.query(
      `DELETE FROM organizations WHERE coordinator_id IN (
         SELECT id FROM users WHERE email = ANY($1)
       )`,
      [testEmails]
    );
    await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [testEmails]);
  };

  // Initial cleanup
  await cleanupDatabase();

  let tokenCoord1;
  let idCoord1;
  let tokenCoord2;
  let idCoord2;
  let tokenVol;
  let idVol;

  let orgAId;
  let orgBId;
  let createdOpportunityId;

  try {
    // ----------------------------------------------------------------
    // Setup: Register and Login users
    // ----------------------------------------------------------------
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coord1),
    });
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coord2),
    });
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(volunteer),
    });

    const loginRes1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: coord1.email, password: coord1.password }),
    });
    const loginData1 = await loginRes1.json();
    tokenCoord1 = loginData1.data?.token;
    idCoord1 = loginData1.data?.user?.id;

    const loginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: coord2.email, password: coord2.password }),
    });
    const loginData2 = await loginRes2.json();
    tokenCoord2 = loginData2.data?.token;
    idCoord2 = loginData2.data?.user?.id;

    const loginRes3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteer.email, password: volunteer.password }),
    });
    const loginData3 = await loginRes3.json();
    tokenVol = loginData3.data?.token;
    idVol = loginData3.data?.user?.id;

    // Create Organization A owned by Coordinator 1
    const orgResA = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Coord 1 Green Earth Initiative',
        description: 'Organization A dedicated to environmental activities.',
      }),
    });
    const orgDataA = await orgResA.json();
    orgAId = orgDataA.data?.organization?.id;

    // Create Organization B owned by Coordinator 2
    const orgResB = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        name: 'Coord 2 Food Relief Network',
        description: 'Organization B dedicated to community food distribution.',
      }),
    });
    const orgDataB = await orgResB.json();
    orgBId = orgDataB.data?.organization?.id;

    const validOpportunityPayload = {
      organization_id: orgAId,
      title: 'Beach Cleanup Drive',
      description: 'Community beach cleanup activity to restore marine habitats.',
      category: 'Environment',
      event_date: '2026-10-10',
      start_time: '09:00',
      end_time: '12:00',
      location: 'Bengaluru Beach Park',
      address: 'Near 4th Block, Koramangala',
      capacity: 50,
      status: 'DRAFT',
    };

    // ----------------------------------------------------------------
    // Test 1: Coordinator creates opportunity for their own organization -> 201
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 1: Coordinator creates opportunity for their own organization${colors.reset}`);
    const res1 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify(validOpportunityPayload),
    });
    const data1 = await res1.json();
    createdOpportunityId = data1.data?.opportunity?.id;
    assert(
      res1.status === 201 &&
      data1.status === 'success' &&
      data1.data?.opportunity?.title === validOpportunityPayload.title,
      'POST /api/opportunities by owning COORDINATOR returns HTTP 201 Created',
      `Status: ${res1.status}, Body: ${JSON.stringify(data1)}`
    );

    // ----------------------------------------------------------------
    // Test 2: Created opportunity contains correct organization_id
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 2: Created opportunity contains correct organization_id${colors.reset}`);
    assert(
      data1.data?.opportunity?.organization_id === orgAId,
      'Created opportunity references the requested organization_id',
      `Expected: ${orgAId}, Got: ${data1.data?.opportunity?.organization_id}`
    );

    // ----------------------------------------------------------------
    // Test 3: Coordinator ownership is correctly verified
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 3: Coordinator ownership is correctly verified${colors.reset}`);
    assert(
      Boolean(createdOpportunityId),
      'Ownership verification succeeded for organization owned by authenticated coordinator'
    );

    // ----------------------------------------------------------------
    // Test 4: Coordinator cannot create opportunity for another Coordinator's organization -> 403
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 4: Coordinator cannot create opportunity for another Coordinator's organization${colors.reset}`);
    const res4 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`, // Coord 1 attempts to create for Org B (owned by Coord 2)
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        organization_id: orgBId,
        title: 'Unauthorized Opportunity by Coord 1 on Org B',
      }),
    });
    const data4 = await res4.json();
    assert(
      res4.status === 403 &&
      data4.status === 'error' &&
      data4.message.toLowerCase().includes('permission'),
      'Coordinator attempting to create on another coordinator organization returns HTTP 403 Forbidden',
      `Status: ${res4.status}, Message: ${data4.message}`
    );

    // ----------------------------------------------------------------
    // Test 5: Volunteer cannot create opportunity -> 403
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 5: Volunteer cannot create opportunity${colors.reset}`);
    const res5 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol}`,
      },
      body: JSON.stringify(validOpportunityPayload),
    });
    const data5 = await res5.json();
    assert(
      res5.status === 403 &&
      data5.status === 'error',
      'VOLUNTEER attempting to create opportunity returns HTTP 403 Forbidden',
      `Status: ${res5.status}`
    );

    // ----------------------------------------------------------------
    // Test 6: Missing JWT -> 401
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 6: Missing JWT${colors.reset}`);
    const res6 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validOpportunityPayload),
    });
    const data6 = await res6.json();
    assert(
      res6.status === 401 && data6.status === 'error',
      'POST /api/opportunities without JWT returns HTTP 401 Unauthorized',
      `Status: ${res6.status}`
    );

    // ----------------------------------------------------------------
    // Test 7: Missing organization_id -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 7: Missing organization_id${colors.reset}`);
    const res7 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        organization_id: undefined,
      }),
    });
    const data7 = await res7.json();
    assert(
      res7.status === 400 && data7.status === 'error',
      'Missing organization_id returns HTTP 400 Bad Request',
      `Status: ${res7.status}, Message: ${data7.message}`
    );

    // ----------------------------------------------------------------
    // Test 8: Invalid organization UUID -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 8: Invalid organization UUID${colors.reset}`);
    const res8 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        organization_id: 'not-a-valid-uuid',
      }),
    });
    const data8 = await res8.json();
    assert(
      res8.status === 400 && data8.status === 'error',
      'Malformed organization UUID returns HTTP 400 Bad Request',
      `Status: ${res8.status}, Message: ${data8.message}`
    );

    // ----------------------------------------------------------------
    // Test 9: Missing title -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 9: Missing title${colors.reset}`);
    const res9 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        title: '',
      }),
    });
    const data9 = await res9.json();
    assert(
      res9.status === 400 && data9.status === 'error',
      'Missing title returns HTTP 400 Bad Request',
      `Status: ${res9.status}, Message: ${data9.message}`
    );

    // ----------------------------------------------------------------
    // Test 10: Invalid title (blank or single char) -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 10: Invalid title (single character or whitespace)${colors.reset}`);
    const res10a = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        title: 'A',
      }),
    });
    const data10a = await res10a.json();

    const res10b = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        title: '   ',
      }),
    });
    const data10b = await res10b.json();

    assert(
      res10a.status === 400 && res10b.status === 400,
      'Title with < 2 characters or whitespace returns HTTP 400 Bad Request',
      `Single char: ${res10a.status}, Whitespace: ${res10b.status}`
    );

    // ----------------------------------------------------------------
    // Test 11: Invalid description -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 11: Invalid description${colors.reset}`);
    const res11 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        description: 12345, // Not a string
      }),
    });
    const data11 = await res11.json();
    assert(
      res11.status === 400 && data11.status === 'error',
      'Non-string description returns HTTP 400 Bad Request',
      `Status: ${res11.status}, Message: ${data11.message}`
    );

    // ----------------------------------------------------------------
    // Test 12: Invalid event date -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 12: Invalid event date${colors.reset}`);
    const res12 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        event_date: 'not-a-date',
      }),
    });
    const data12 = await res12.json();
    assert(
      res12.status === 400 && data12.status === 'error',
      'Malformed event date returns HTTP 400 Bad Request',
      `Status: ${res12.status}, Message: ${data12.message}`
    );

    // ----------------------------------------------------------------
    // Test 13: Invalid start time -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 13: Invalid start time${colors.reset}`);
    const res13 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        start_time: '25:99', // Invalid hour and minute
      }),
    });
    const data13 = await res13.json();
    assert(
      res13.status === 400 && data13.status === 'error',
      'Invalid start time format returns HTTP 400 Bad Request',
      `Status: ${res13.status}, Message: ${data13.message}`
    );

    // ----------------------------------------------------------------
    // Test 14: Invalid end time -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 14: Invalid end time${colors.reset}`);
    const res14 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        end_time: 'invalid-time',
      }),
    });
    const data14 = await res14.json();
    assert(
      res14.status === 400 && data14.status === 'error',
      'Invalid end time format returns HTTP 400 Bad Request',
      `Status: ${res14.status}, Message: ${data14.message}`
    );

    // ----------------------------------------------------------------
    // Test 15: End time earlier than start time -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 15: End time earlier than start time${colors.reset}`);
    const res15 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        start_time: '14:00',
        end_time: '10:00', // Earlier than start time
      }),
    });
    const data15 = await res15.json();
    assert(
      res15.status === 400 &&
      data15.status === 'error' &&
      data15.message.toLowerCase().includes('earlier'),
      'End time earlier than start time returns HTTP 400 Bad Request',
      `Status: ${res15.status}, Message: ${data15.message}`
    );

    // ----------------------------------------------------------------
    // Test 16: Invalid capacity -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 16: Invalid capacity${colors.reset}`);
    const res16a = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        capacity: 0, // Must be > 0
      }),
    });
    const data16a = await res16a.json();

    const res16b = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        capacity: -10, // Negative
      }),
    });
    const data16b = await res16b.json();

    assert(
      res16a.status === 400 && res16b.status === 400,
      'Capacity <= 0 returns HTTP 400 Bad Request',
      `Zero cap: ${res16a.status}, Negative cap: ${res16b.status}`
    );

    // ----------------------------------------------------------------
    // Test 17: Invalid status -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 17: Invalid status${colors.reset}`);
    const res17 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        ...validOpportunityPayload,
        status: 'NON_EXISTENT_STATUS',
      }),
    });
    const data17 = await res17.json();
    assert(
      res17.status === 400 && data17.status === 'error',
      'Invalid status enum returns HTTP 400 Bad Request',
      `Status: ${res17.status}, Message: ${data17.message}`
    );

    // ----------------------------------------------------------------
    // Test 18: GET /api/opportunities returns 200
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 18: GET /api/opportunities returns 200${colors.reset}`);
    const res18 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const data18 = await res18.json();
    assert(
      res18.status === 200 &&
      data18.status === 'success' &&
      Array.isArray(data18.data?.opportunities),
      'GET /api/opportunities returns HTTP 200 OK with opportunities array',
      `Status: ${res18.status}`
    );

    // ----------------------------------------------------------------
    // Test 19: Volunteer can list opportunities -> 200
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 19: Volunteer can list opportunities${colors.reset}`);
    const res19 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    const data19 = await res19.json();
    assert(
      res19.status === 200 &&
      data19.status === 'success' &&
      Array.isArray(data19.data?.opportunities),
      'VOLUNTEER -> GET /api/opportunities returns HTTP 200 OK',
      `Status: ${res19.status}`
    );

    // ----------------------------------------------------------------
    // Test 20: Coordinator can list opportunities -> 200
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 20: Coordinator can list opportunities${colors.reset}`);
    const res20 = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const data20 = await res20.json();
    assert(
      res20.status === 200 &&
      data20.status === 'success' &&
      Array.isArray(data20.data?.opportunities),
      'COORDINATOR -> GET /api/opportunities returns HTTP 200 OK',
      `Status: ${res20.status}`
    );

    // ----------------------------------------------------------------
    // Test 21: GET /api/opportunities/:id returns correct opportunity -> 200
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 21: GET /api/opportunities/:id returns correct opportunity${colors.reset}`);
    const res21 = await fetch(`${baseUrl}/api/opportunities/${createdOpportunityId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    const data21 = await res21.json();
    assert(
      res21.status === 200 &&
      data21.status === 'success' &&
      data21.data?.opportunity?.id === createdOpportunityId &&
      data21.data?.opportunity?.title === validOpportunityPayload.title,
      'GET /api/opportunities/:id returns HTTP 200 with matching opportunity record',
      `Status: ${res21.status}, ID: ${data21.data?.opportunity?.id}`
    );

    // ----------------------------------------------------------------
    // Test 22: Non-existent opportunity -> 404
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 22: Non-existent opportunity${colors.reset}`);
    const nonExistentUUID = '00000000-0000-4000-a000-000000000000';
    const res22 = await fetch(`${baseUrl}/api/opportunities/${nonExistentUUID}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    const data22 = await res22.json();
    assert(
      res22.status === 404 &&
      data22.status === 'error' &&
      data22.message.toLowerCase().includes('not found'),
      'Non-existent opportunity UUID returns HTTP 404 Not Found',
      `Status: ${res22.status}, Message: ${data22.message}`
    );

    // ----------------------------------------------------------------
    // Test 23: Malformed opportunity UUID -> 400
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 23: Malformed opportunity UUID${colors.reset}`);
    const res23 = await fetch(`${baseUrl}/api/opportunities/not-a-valid-uuid-xyz`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    const data23 = await res23.json();
    assert(
      res23.status === 400 &&
      data23.status === 'error' &&
      data23.message.toLowerCase().includes('uuid'),
      'Malformed opportunity ID in URL returns HTTP 400 Bad Request',
      `Status: ${res23.status}, Message: ${data23.message}`
    );

    // ----------------------------------------------------------------
    // Test 24: Existing registration tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 24: Registration API still functional${colors.reset}`);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Reg Check User',
        email: 'opp.regression@test.org',
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
    await pool.query('DELETE FROM users WHERE email = $1', ['opp.regression@test.org']);

    // ----------------------------------------------------------------
    // Test 25: Existing login tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 25: Login API still functional${colors.reset}`);
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: coord1.email, password: coord1.password }),
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && Boolean(loginData.data?.token),
      'POST /api/auth/login returns HTTP 200 with token',
      `Status: ${loginRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 26: Existing JWT middleware tests still pass (/api/auth/me)
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 26: GET /api/auth/me still operational${colors.reset}`);
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.data?.user?.email === coord1.email,
      'GET /api/auth/me returns HTTP 200 with profile',
      `Status: ${meRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 27: Existing RBAC tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 27: RBAC coordinator and volunteer test routes${colors.reset}`);
    const rbacC = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const rbacV = await fetch(`${baseUrl}/api/auth/coordinator-test`, {
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    assert(
      rbacC.status === 200 && rbacV.status === 403,
      'RBAC endpoints correctly allow coordinator and forbid volunteer',
      `Coord: ${rbacC.status}, Vol: ${rbacV.status}`
    );

    // ----------------------------------------------------------------
    // Test 28: Existing Organization tests still pass
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 28: Organization endpoints still functional${colors.reset}`);
    const orgsRes = await fetch(`${baseUrl}/api/organizations`, {
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    const orgsData = await orgsRes.json();
    assert(
      orgsRes.status === 200 && Array.isArray(orgsData.data?.organizations),
      'GET /api/organizations remains operational (HTTP 200)',
      `Status: ${orgsRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 29: GET /api/health still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 29: GET /api/health still operational${colors.reset}`);
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok' && healthData.service === 'api',
      'GET /api/health returns HTTP 200 { status: "ok", service: "api" }',
      `Status: ${healthRes.status}`
    );

    // ----------------------------------------------------------------
    // Test 30: GET /api/health/db still works
    // ----------------------------------------------------------------
    console.log(`\n${colors.bold}Test 30: GET /api/health/db still operational${colors.reset}`);
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
    await cleanupDatabase();

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
