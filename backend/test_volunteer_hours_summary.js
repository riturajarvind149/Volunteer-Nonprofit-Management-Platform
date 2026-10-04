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
  console.log(`  DAY 23: VOLUNTEER HOURS SUMMARY & AGGREGATION TEST SUITE   `);
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
    full_name: 'Summary Coordinator One',
    email: `coord1.summary.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Summary Coordinator Two',
    email: `coord2.summary.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinatorEmpty = {
    full_name: 'Summary Coordinator Empty',
    email: `coordempty.summary.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Summary Volunteer Alice',
    email: `vol1.summary.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Summary Volunteer Bob',
    email: `vol2.summary.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteerEmpty = {
    full_name: 'Summary Volunteer Empty',
    email: `volempty.summary.${timestamp}@test.org`,
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

    // Register users
    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(coordinatorEmpty);
    await registerUser(volunteer1);
    await registerUser(volunteer2);
    await registerUser(volunteerEmpty);

    // Login users
    const { token: tokenCoord1, user: userCoord1 } = await loginUser(coordinator1.email, coordinator1.password);
    const { token: tokenCoord2, user: userCoord2 } = await loginUser(coordinator2.email, coordinator2.password);
    const { token: tokenCoordEmpty } = await loginUser(coordinatorEmpty.email, coordinatorEmpty.password);
    const { token: tokenVol1, user: userVol1 } = await loginUser(volunteer1.email, volunteer1.password);
    const { token: tokenVol2, user: userVol2 } = await loginUser(volunteer2.email, volunteer2.password);
    const { token: tokenVolEmpty } = await loginUser(volunteerEmpty.email, volunteerEmpty.password);

    // Setup:
    // 1. Coordinator 1 creates Org 1
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Coord 1 Eco Initiative',
        description: 'Org 1 for summary testing',
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
        name: 'Coord 2 Animal Haven',
        description: 'Org 2 for summary testing',
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
        title: 'Tree Planting Drive',
        description: 'Planting native trees',
        category: 'Environment',
        event_date: '2026-11-25',
        start_time: '09:00:00',
        end_time: '14:00:00',
        location: 'Eco Reserve',
        address: '10 Forest Lane',
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
        title: 'Dog Walking Weekend',
        description: 'Exercising shelter dogs',
        category: 'Animal Welfare',
        event_date: '2026-11-26',
        start_time: '10:00:00',
        end_time: '13:00:00',
        location: 'Animal Sanctuary',
        address: '20 Paw Way',
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

    // 8. Record Hours:
    // - Vol 1, Opp 1 (Coord 1): 4.0 hours, VERIFIED
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

    // - Vol 1, Opp 1 (Coord 1): 1.5 hours, PENDING
    const rec2Res = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 1.5, status: 'PENDING' }),
    });

    // - Vol 2, Opp 1 (Coord 1): 3.0 hours, RECORDED
    const rec3Res = await fetch(`${baseUrl}/api/signups/${signup3Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 3.0, status: 'RECORDED' }),
    });

    // - Vol 1, Opp 2 (Coord 2): 2.5 hours, RECORDED
    const rec4Res = await fetch(`${baseUrl}/api/signups/${signup2Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({ hours: 2.5, status: 'RECORDED' }),
    });

    console.log(`Test setup completed with 4 recorded hours entries across 2 organizations and 2 volunteers.\n`);

    // ================================================================
    // Group 1: Authentication & Authorization Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated request to /api/hours/my/summary returns 401
    const unauthVolRes = await fetch(`${baseUrl}/api/hours/my/summary`);
    assert(
      unauthVolRes.status === 401,
      'Test 1: Unauthenticated GET /api/hours/my/summary returns 401 Unauthorized'
    );

    // Test 2: Unauthenticated request to /api/hours/organization/summary returns 401
    const unauthCoordRes = await fetch(`${baseUrl}/api/hours/organization/summary`);
    assert(
      unauthCoordRes.status === 401,
      'Test 2: Unauthenticated GET /api/hours/organization/summary returns 401 Unauthorized'
    );

    // Test 3: Coordinator cannot access volunteer summary endpoint (RBAC 403)
    const coordAccessVolRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      coordAccessVolRes.status === 403,
      'Test 3: Coordinator accessing GET /api/hours/my/summary returns 403 Forbidden'
    );

    // Test 4: Volunteer cannot access coordinator organization summary endpoint (RBAC 403)
    const volAccessCoordRes = await fetch(`${baseUrl}/api/hours/organization/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      volAccessCoordRes.status === 403,
      'Test 4: Volunteer accessing GET /api/hours/organization/summary returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Volunteer Summary (GET /api/hours/my/summary)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Volunteer Summary (GET /api/hours/my/summary)${colors.reset}`);

    // Test 5: Volunteer 1 retrieves their own aggregated summary
    // Expected for Vol 1:
    // Total hours: 4.0 + 1.5 + 2.5 = 8.00
    // Total records: 3
    // Verified hours: 4.00
    // Recorded hours: 2.50
    // Pending hours: 1.50
    const vol1SumRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const vol1SumData = await vol1SumRes.json();
    const vol1Summary = vol1SumData.data?.summary || vol1SumData.data;

    assert(
      vol1SumRes.status === 200 && vol1SumData.status === 'success' && vol1Summary !== undefined,
      'Test 5: Volunteer 1 retrieves summary successfully with HTTP 200 OK'
    );

    // Test 6: Volunteer 1 total_hours is numerically accurate (8.00)
    assert(
      vol1Summary.total_hours === 8.0,
      `Test 6: Volunteer 1 total_hours is correct (expected 8.0, got ${vol1Summary.total_hours})`
    );

    // Test 7: Volunteer 1 total_records is correct (3)
    assert(
      vol1Summary.total_records === 3,
      `Test 7: Volunteer 1 total_records is correct (expected 3, got ${vol1Summary.total_records})`
    );

    // Test 8: Volunteer 1 status-wise hour breakdown is accurate
    assert(
      vol1Summary.verified_hours === 4.0 &&
        vol1Summary.recorded_hours === 2.5 &&
        vol1Summary.pending_hours === 1.5,
      `Test 8: Volunteer 1 status totals correct (verified: ${vol1Summary.verified_hours}, recorded: ${vol1Summary.recorded_hours}, pending: ${vol1Summary.pending_hours})`
    );

    // Test 9: Volunteer 2 retrieves strictly their own summary
    // Expected for Vol 2:
    // Total hours: 3.00, Records: 1, Verified: 0.00, Recorded: 3.00, Pending: 0.00
    const vol2SumRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol2}` },
    });
    const vol2SumData = await vol2SumRes.json();
    const vol2Summary = vol2SumData.data?.summary || vol2SumData.data;

    assert(
      vol2Summary.total_hours === 3.0 &&
        vol2Summary.total_records === 1 &&
        vol2Summary.verified_hours === 0 &&
        vol2Summary.recorded_hours === 3.0 &&
        vol2Summary.pending_hours === 0,
      'Test 9: Volunteer 2 summary strictly reflects only their own records'
    );

    // Test 10: Anti-spoofing: volunteer_id in query parameter is ignored
    const spoofQueryRes = await fetch(`${baseUrl}/api/hours/my/summary?volunteer_id=${userVol2.id}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const spoofQueryData = await spoofQueryRes.json();
    const spoofSummary = spoofQueryData.data?.summary || spoofQueryData.data;

    assert(
      spoofSummary.total_hours === 8.0 && spoofSummary.total_records === 3,
      'Test 10: Anti-spoofing: volunteer_id query param is ignored; identity strictly derived from req.user.id'
    );

    // Test 11: Zero-hour volunteer receives zero totals
    const emptyVolRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVolEmpty}` },
    });
    const emptyVolData = await emptyVolRes.json();
    const emptyVolSummary = emptyVolData.data?.summary || emptyVolData.data;

    assert(
      emptyVolRes.status === 200 &&
        emptyVolSummary.total_hours === 0 &&
        emptyVolSummary.total_records === 0 &&
        emptyVolSummary.verified_hours === 0 &&
        emptyVolSummary.recorded_hours === 0 &&
        emptyVolSummary.pending_hours === 0,
      'Test 11: Volunteer with zero records receives zero totals with HTTP 200 OK'
    );

    // ================================================================
    // Group 3: Coordinator Organization Summary (GET /api/hours/organization/summary)
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Coordinator Organization Summary (GET /api/hours/organization/summary)${colors.reset}`);

    // Test 12: Coordinator 1 retrieves summary for their organization
    // Expected for Coord 1 (Org 1):
    // Total hours: 4.0 + 1.5 + 3.0 = 8.50
    // Total records: 3
    // Verified hours: 4.00
    // Recorded hours: 3.00
    // Pending hours: 1.50
    // Total volunteers: 2 (Vol 1 and Vol 2)
    const coord1SumRes = await fetch(`${baseUrl}/api/hours/organization/summary`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const coord1SumData = await coord1SumRes.json();
    const coord1Summary = coord1SumData.data?.summary || coord1SumData.data;

    assert(
      coord1SumRes.status === 200 && coord1SumData.status === 'success' && coord1Summary !== undefined,
      'Test 12: Coordinator 1 retrieves organization summary successfully with HTTP 200 OK'
    );

    // Test 13: Coordinator 1 total_hours is 8.50
    assert(
      coord1Summary.total_hours === 8.5,
      `Test 13: Coordinator 1 total_hours is correct (expected 8.5, got ${coord1Summary.total_hours})`
    );

    // Test 14: Coordinator 1 total_records is 3
    assert(
      coord1Summary.total_records === 3,
      `Test 14: Coordinator 1 total_records is correct (expected 3, got ${coord1Summary.total_records})`
    );

    // Test 15: Coordinator 1 status breakdown is accurate
    assert(
      coord1Summary.verified_hours === 4.0 &&
        coord1Summary.recorded_hours === 3.0 &&
        coord1Summary.pending_hours === 1.5,
      `Test 15: Coordinator 1 status-wise hours correct (verified: ${coord1Summary.verified_hours}, recorded: ${coord1Summary.recorded_hours}, pending: ${coord1Summary.pending_hours})`
    );

    // Test 16: Coordinator 1 total_volunteers is 2 distinct volunteers
    assert(
      coord1Summary.total_volunteers === 2,
      `Test 16: Coordinator 1 distinct volunteer count is correct (expected 2, got ${coord1Summary.total_volunteers})`
    );

    // Test 17: Coordinator 2 strictly retrieves only their organization's summary
    // Expected for Coord 2 (Org 2):
    // Total hours: 2.50, Total records: 1, Recorded: 2.50, Verified: 0, Pending: 0, Volunteers: 1 (Vol 1)
    const coord2SumRes = await fetch(`${baseUrl}/api/hours/organization/summary`, {
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const coord2SumData = await coord2SumRes.json();
    const coord2Summary = coord2SumData.data?.summary || coord2SumData.data;

    assert(
      coord2Summary.total_hours === 2.5 &&
        coord2Summary.total_records === 1 &&
        coord2Summary.recorded_hours === 2.5 &&
        coord2Summary.verified_hours === 0 &&
        coord2Summary.pending_hours === 0 &&
        coord2Summary.total_volunteers === 1,
      "Test 17: Coordinator 2 strictly retrieves only their organization's summary (isolated from Coord 1)"
    );

    // Test 18: Zero-hour coordinator receives zero totals
    const emptyCoordRes = await fetch(`${baseUrl}/api/hours/organization/summary`, {
      headers: { Authorization: `Bearer ${tokenCoordEmpty}` },
    });
    const emptyCoordData = await emptyCoordRes.json();
    const emptyCoordSummary = emptyCoordData.data?.summary || emptyCoordData.data;

    assert(
      emptyCoordRes.status === 200 &&
        emptyCoordSummary.total_hours === 0 &&
        emptyCoordSummary.total_records === 0 &&
        emptyCoordSummary.verified_hours === 0 &&
        emptyCoordSummary.recorded_hours === 0 &&
        emptyCoordSummary.pending_hours === 0 &&
        emptyCoordSummary.total_volunteers === 0,
      'Test 18: Coordinator with no organizations/records receives zero totals with HTTP 200 OK'
    );

    // ================================================================
    // Group 4: Regression of Existing Functionality (Days 20, 21, 22)
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Regression of Existing Functionality (Days 20, 21, 22)${colors.reset}`);

    // Test 19: Day 20 Recording still operational
    const extraRecordRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 1.0, status: 'RECORDED' }),
    });
    assert(
      extraRecordRes.status === 201,
      'Test 19: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 20: Day 21 Retrieval still operational
    const myHoursRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const myHoursData = await myHoursRes.json();
    assert(
      myHoursRes.status === 200 && Array.isArray(myHoursData.data?.volunteer_hours),
      'Test 20: Day 21 GET /api/hours/my remains operational (200 OK)'
    );

    // Test 21: Day 22 Status Update still operational
    const statusUpdateRes = await fetch(`${baseUrl}/api/hours/${rec1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'RECORDED' }),
    });
    const statusUpdateData = await statusUpdateRes.json();
    assert(
      statusUpdateRes.status === 200 && statusUpdateData.data?.volunteer_hours?.status === 'RECORDED',
      'Test 21: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 22: No sensitive user fields exposed in summary responses
    const volSumStr = JSON.stringify(vol1SumData);
    const coordSumStr = JSON.stringify(coord1SumData);
    assert(
      !volSumStr.includes('password') && !coordSumStr.includes('password'),
      'Test 22: Summary responses do not leak password or password_hash'
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
  console.log(`  DAY 23 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
