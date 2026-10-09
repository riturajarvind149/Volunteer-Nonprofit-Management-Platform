require('dotenv').config();
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
  console.log(`  DAY 21: VOLUNTEER HOURS RETRIEVAL & SUMMARY TEST SUITE     `);
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

  const timestamp = Date.now();
  const coordinator1 = {
    full_name: 'Retrieval Coordinator One',
    email: `coord1.retrieval.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Retrieval Coordinator Two',
    email: `coord2.retrieval.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinatorEmpty = {
    full_name: 'Retrieval Coordinator Empty',
    email: `coordempty.retrieval.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Retrieval Volunteer Alice',
    email: `vol1.retrieval.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Retrieval Volunteer Bob',
    email: `vol2.retrieval.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteerEmpty = {
    full_name: 'Retrieval Volunteer Empty',
    email: `volempty.retrieval.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator1.email,
    coordinator2.email,
    coordinatorEmpty.email,
    volunteer1.email,
    volunteer2.email,
    volunteerEmpty.email,
  ];

  const cleanupDatabase = async () => {
    await pool.query(
      `DELETE FROM volunteer_hours WHERE recorded_by IN (
         SELECT id FROM users WHERE email = ANY($1)
       ) OR signup_id IN (
         SELECT id FROM signups WHERE volunteer_id IN (
           SELECT id FROM users WHERE email = ANY($1)
         )
       )`,
      [testEmails]
    );
    await pool.query(
      `DELETE FROM signups WHERE volunteer_id IN (
         SELECT id FROM users WHERE email = ANY($1)
       )`,
      [testEmails]
    );
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
    await pool.query(
      `DELETE FROM users WHERE email = ANY($1)`,
      [testEmails]
    );
  };

  try {
    await cleanupDatabase();

    // Helper: register user
    const registerUser = async (userObj) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userObj),
      });
      return await res.json();
    };

    // Helper: login user
    const loginUser = async (email, password) => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return { status: res.status, token: data.data?.token, user: data.data?.user };
    };

    // Register test users
    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(coordinatorEmpty);
    await registerUser(volunteer1);
    await registerUser(volunteer2);
    await registerUser(volunteerEmpty);

    // Login test users
    const { token: tokenCoord1, user: userCoord1 } = await loginUser(coordinator1.email, coordinator1.password);
    const { token: tokenCoord2, user: userCoord2 } = await loginUser(coordinator2.email, coordinator2.password);
    const { token: tokenCoordEmpty } = await loginUser(coordinatorEmpty.email, coordinatorEmpty.password);
    const { token: tokenVol1, user: userVol1 } = await loginUser(volunteer1.email, volunteer1.password);
    const { token: tokenVol2, user: userVol2 } = await loginUser(volunteer2.email, volunteer2.password);
    const { token: tokenVolEmpty } = await loginUser(volunteerEmpty.email, volunteerEmpty.password);

    // Setup entities:
    // 1. Coordinator 1 creates Org 1
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Coord 1 Green Earth NGO',
        description: 'Organization 1 for retrieval testing',
      }),
    });
    const org1Data = await org1Res.json();
    const org1Id = org1Data.data.organization.id;

    // 2. Coordinator 2 creates Org 2
    const org2Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        name: 'Coord 2 Blue Ocean NGO',
        description: 'Organization 2 for retrieval testing',
      }),
    });
    const org2Data = await org2Res.json();
    const org2Id = org2Data.data.organization.id;

    // 3. Coordinator 1 creates Opportunity 1
    const opp1Res = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        organization_id: org1Id,
        title: 'Community Tree Planting',
        description: 'Planting trees in the park',
        category: 'Environment',
        event_date: '2026-11-15',
        start_time: '09:00:00',
        end_time: '13:00:00',
        location: 'City Green Park',
        address: '123 Park Ave',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    const opp1Data = await opp1Res.json();
    const opp1Id = opp1Data.data.opportunity.id;

    // 4. Coordinator 2 creates Opportunity 2
    const opp2Res = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        organization_id: org2Id,
        title: 'Beach Cleanup Initiative',
        description: 'Cleaning up the beach',
        category: 'Environment',
        event_date: '2026-11-20',
        start_time: '08:00:00',
        end_time: '12:00:00',
        location: 'Sunny Beach',
        address: '456 Ocean Blvd',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    const opp2Data = await opp2Res.json();
    const opp2Id = opp2Data.data.opportunity.id;

    // 5. Volunteer 1 signs up for Opportunity 1
    const signup1Res = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const signup1Data = await signup1Res.json();
    const signup1Id = signup1Data.data.signup.id;

    // 6. Volunteer 1 signs up for Opportunity 2
    const signup2Res = await fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const signup2Data = await signup2Res.json();
    const signup2Id = signup2Data.data.signup.id;

    // 7. Volunteer 2 signs up for Opportunity 1
    const signup3Res = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol2}`,
      },
    });
    const signup3Data = await signup3Res.json();
    const signup3Id = signup3Data.data.signup.id;

    // 8. Record hours:
    // Coord 1 records 4.0 hours for Vol 1 on Opp 1
    const rec1Res = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4.0, status: 'VERIFIED' }),
    });
    const rec1Data = await rec1Res.json();
    const rec1Id = rec1Data.data.volunteer_hours.id;

    // Coord 1 records 3.5 hours for Vol 2 on Opp 1
    const rec2Res = await fetch(`${baseUrl}/api/signups/${signup3Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 3.5, status: 'RECORDED' }),
    });
    const rec2Data = await rec2Res.json();
    const rec2Id = rec2Data.data.volunteer_hours.id;

    // Coord 2 records 5.0 hours for Vol 1 on Opp 2
    const rec3Res = await fetch(`${baseUrl}/api/signups/${signup2Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({ hours: 5.0, status: 'VERIFIED' }),
    });
    const rec3Data = await rec3Res.json();
    const rec3Id = rec3Data.data.volunteer_hours.id;

    console.log(`Test setup completed with 3 recorded hours entries.\n`);

    // ================================================================
    // Group 1: Authentication & Authorization Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated request to /api/hours/my returns 401
    const noAuthVolRes = await fetch(`${baseUrl}/api/hours/my`);
    assert(
      noAuthVolRes.status === 401,
      'Test 1: Unauthenticated GET /api/hours/my returns 401 Unauthorized'
    );

    // Test 2: Unauthenticated request to /api/hours/organization returns 401
    const noAuthCoordRes = await fetch(`${baseUrl}/api/hours/organization`);
    assert(
      noAuthCoordRes.status === 401,
      'Test 2: Unauthenticated GET /api/hours/organization returns 401 Unauthorized'
    );

    // Test 3: Invalid JWT returns 401
    const badTokenRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    assert(
      badTokenRes.status === 401,
      'Test 3: Invalid JWT returns 401 Unauthorized'
    );

    // Test 4: Volunteer cannot access coordinator endpoint (RBAC 403)
    const volAccessCoordRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      volAccessCoordRes.status === 403,
      'Test 4: Volunteer accessing GET /api/hours/organization returns 403 Forbidden'
    );

    // Test 5: Coordinator cannot access volunteer endpoint (RBAC 403)
    const coordAccessVolRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      coordAccessVolRes.status === 403,
      'Test 5: Coordinator accessing GET /api/hours/my returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Volunteer View (GET /api/hours/my)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Volunteer View (GET /api/hours/my)${colors.reset}`);

    // Test 6: Authenticated volunteer retrieves their own hours
    const vol1HoursRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const vol1HoursData = await vol1HoursRes.json();
    const hoursListVol1 = vol1HoursData.data?.volunteer_hours || vol1HoursData.data?.hours;

    assert(
      vol1HoursRes.status === 200 &&
        vol1HoursData.status === 'success' &&
        Array.isArray(hoursListVol1) &&
        hoursListVol1.length === 2,
      `Test 6: Authenticated volunteer retrieves own hours list (found ${hoursListVol1?.length} records)`
    );

    // Test 7: Verify required fields in volunteer hours response
    const firstVol1Record = hoursListVol1?.[0];
    const hasRequiredFields =
      firstVol1Record &&
      firstVol1Record.id !== undefined &&
      firstVol1Record.signup_id !== undefined &&
      firstVol1Record.opportunity_id !== undefined &&
      Boolean(firstVol1Record.opportunity_title) &&
      Boolean(firstVol1Record.organization_name) &&
      firstVol1Record.hours !== undefined &&
      firstVol1Record.status !== undefined &&
      firstVol1Record.created_at !== undefined &&
      firstVol1Record.updated_at !== undefined;

    assert(
      hasRequiredFields,
      'Test 7: Response includes id, signup_id, opportunity_id, opportunity_title, organization_name, hours, status, created_at, updated_at'
    );

    // Test 8: Volunteer 1 sees hours across multiple organizations they volunteered for
    const titles = hoursListVol1.map((r) => r.opportunity_title);
    assert(
      titles.includes('Community Tree Planting') && titles.includes('Beach Cleanup Initiative'),
      'Test 8: Volunteer retrieves hours from all their completed signups across organizations'
    );

    // Test 9: Volunteer 2 only sees their own hours (1 record)
    const vol2HoursRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol2}` },
    });
    const vol2HoursData = await vol2HoursRes.json();
    const hoursListVol2 = vol2HoursData.data?.volunteer_hours || vol2HoursData.data?.hours;

    assert(
      vol2HoursRes.status === 200 &&
        Array.isArray(hoursListVol2) &&
        hoursListVol2.length === 1 &&
        parseFloat(hoursListVol2[0].hours) === 3.5 &&
        hoursListVol2[0].signup_id === signup3Id,
      'Test 9: Volunteer 2 strictly retrieves only their own hours record'
    );

    // Test 10: Anti-spoofing: volunteer_id in query/body is ignored
    const spoofQueryRes = await fetch(`${baseUrl}/api/hours/my?volunteer_id=${userVol2.id}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const spoofQueryData = await spoofQueryRes.json();
    const spoofList = spoofQueryData.data?.volunteer_hours || spoofQueryData.data?.hours;
    assert(
      spoofList.length === 2 && spoofList.every((r) => r.signup_id !== signup3Id),
      'Test 10: Anti-spoofing: Query parameter volunteer_id is ignored and req.user.id is enforced'
    );

    // Test 11: Volunteer with zero hours receives empty array [] with 200 OK
    const emptyVolRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVolEmpty}` },
    });
    const emptyVolData = await emptyVolRes.json();
    const emptyVolList = emptyVolData.data?.volunteer_hours || emptyVolData.data?.hours;
    assert(
      emptyVolRes.status === 200 &&
        emptyVolData.status === 'success' &&
        Array.isArray(emptyVolList) &&
        emptyVolList.length === 0,
      'Test 11: Volunteer with zero hours receives HTTP 200 with an empty array []'
    );

    // ================================================================
    // Group 3: Coordinator Organization View (GET /api/hours/organization)
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Coordinator Organization View (GET /api/hours/organization)${colors.reset}`);

    // Test 12: Coordinator 1 retrieves hours for their organization
    const coord1HoursRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const coord1HoursData = await coord1HoursRes.json();
    const coord1List = coord1HoursData.data?.volunteer_hours || coord1HoursData.data?.hours;

    assert(
      coord1HoursRes.status === 200 &&
        coord1HoursData.status === 'success' &&
        Array.isArray(coord1List) &&
        coord1List.length === 2,
      `Test 12: Coordinator 1 retrieves all hours for their organization (found ${coord1List?.length} records)`
    );

    // Test 13: Coordinator view includes volunteer details (name, email)
    const firstCoordRecord = coord1List?.[0];
    const hasVolunteerInfo =
      firstCoordRecord &&
      firstCoordRecord.volunteer_id !== undefined &&
      firstCoordRecord.volunteer_name !== undefined &&
      firstCoordRecord.volunteer_email !== undefined &&
      firstCoordRecord.organization_id === org1Id;

    assert(
      hasVolunteerInfo,
      'Test 13: Coordinator record contains volunteer_id, volunteer_name, volunteer_email, and matching organization_id'
    );

    // Test 14: Coordinator 1 cannot see hours from Coordinator 2's organization (Ownership Isolation)
    const opp2InCoord1 = coord1List.some((r) => r.opportunity_id === opp2Id || r.organization_id === org2Id);
    assert(
      !opp2InCoord1,
      "Test 14: Ownership Isolation: Coordinator 1 cannot see any hours from Coordinator 2's organization"
    );

    // Test 15: Coordinator 2 strictly retrieves hours for their own organization
    const coord2HoursRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const coord2HoursData = await coord2HoursRes.json();
    const coord2List = coord2HoursData.data?.volunteer_hours || coord2HoursData.data?.hours;

    assert(
      coord2HoursRes.status === 200 &&
        coord2List.length === 1 &&
        coord2List[0].opportunity_id === opp2Id &&
        coord2List[0].organization_id === org2Id &&
        parseFloat(coord2List[0].hours) === 5.0,
      "Test 15: Coordinator 2 strictly retrieves only their organization's hours"
    );

    // Test 16: Coordinator with zero organizations/hours receives empty array []
    const emptyCoordRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoordEmpty}` },
    });
    const emptyCoordData = await emptyCoordRes.json();
    const emptyCoordList = emptyCoordData.data?.volunteer_hours || emptyCoordData.data?.hours;

    assert(
      emptyCoordRes.status === 200 &&
        emptyCoordData.status === 'success' &&
        Array.isArray(emptyCoordList) &&
        emptyCoordList.length === 0,
      'Test 16: Coordinator with zero hours receives HTTP 200 with an empty array []'
    );

    // ================================================================
    // Group 4: Data Security & Anti-Leakage
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Data Security & Anti-Leakage${colors.reset}`);

    // Test 17: No sensitive credentials in volunteer response
    const volRawJson = JSON.stringify(vol1HoursData);
    assert(
      !volRawJson.includes('password_hash') && !volRawJson.includes('password'),
      'Test 17: Volunteer hours response does NOT expose password or password_hash'
    );

    // Test 18: No sensitive credentials in coordinator response
    const coordRawJson = JSON.stringify(coord1HoursData);
    assert(
      !coordRawJson.includes('password_hash') && !coordRawJson.includes('password'),
      'Test 18: Coordinator organization hours response does NOT expose password or password_hash'
    );

    // ================================================================
    // Group 5: Regression & System Health
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Regression & System Health${colors.reset}`);

    // Test 19: Health check API still works
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(
      healthRes.status === 200 && healthData.status === 'ok',
      'Test 19: GET /api/health returns 200 { status: "ok" }'
    );

    // Test 20: Database health check still works
    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthData = await dbHealthRes.json();
    assert(
      dbHealthRes.status === 200 && dbHealthData.database === 'connected',
      'Test 20: GET /api/health/db returns 200 { database: "connected" }'
    );

    // Test 21: Existing hours recording endpoint POST /api/signups/:id/hours still operational
    const extraRecordRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 1.5, status: 'RECORDED' }),
    });
    assert(
      extraRecordRes.status === 201,
      'Test 21: Existing POST /api/signups/:signupId/hours remains operational (201 Created)'
    );

  } catch (error) {
    console.error(`Unexpected test runner failure:`, error);
    failed++;
  } finally {
    await cleanupDatabase();
    if (server) {
      server.close();
    }
  }

  console.log(`\n=============================================================`);
  console.log(`  DAY 21 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
