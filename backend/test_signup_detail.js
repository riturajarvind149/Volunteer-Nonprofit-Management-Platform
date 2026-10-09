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
  console.log(`  DAY 28: COORDINATOR SIGNUP DETAIL RETRIEVAL TEST SUITE     `);
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
    full_name: 'Coordinator One Day 28',
    email: `coord1.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Coordinator Two Day 28',
    email: `coord2.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Volunteer Alice Day 28',
    email: `vol1.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Volunteer Bob Day 28',
    email: `vol2.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator1.email,
    coordinator2.email,
    volunteer1.email,
    volunteer2.email,
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
       ) OR opportunity_id IN (
         SELECT id FROM opportunities WHERE organization_id IN (
           SELECT id FROM organizations WHERE coordinator_id IN (
             SELECT id FROM users WHERE email = ANY($1)
           )
         )
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
      return await res.json();
    };

    // Register all users
    const userCoord1Data = await registerUser(coordinator1);
    const userCoord2Data = await registerUser(coordinator2);
    const userVol1Data = await registerUser(volunteer1);
    const userVol2Data = await registerUser(volunteer2);

    const userCoord1 = userCoord1Data.data.user;
    const userCoord2 = userCoord2Data.data.user;
    const userVol1 = userVol1Data.data.user;
    const userVol2 = userVol2Data.data.user;

    const tokenCoord1 = (await loginUser(coordinator1.email, coordinator1.password)).data.token;
    const tokenCoord2 = (await loginUser(coordinator2.email, coordinator2.password)).data.token;
    const tokenVol1 = (await loginUser(volunteer1.email, volunteer1.password)).data.token;
    const tokenVol2 = (await loginUser(volunteer2.email, volunteer2.password)).data.token;

    // Helper: create organization
    const createOrg = async (name, token) => {
      const res = await fetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          description: `Test Org description for ${name}`,
        }),
      });
      const data = await res.json();
      return data.data.organization.id;
    };

    const org1Id = await createOrg(`Org One Detail ${timestamp}`, tokenCoord1);
    const org2Id = await createOrg(`Org Two Detail ${timestamp}`, tokenCoord2);

    // Helper: create opportunity
    const createOpp = async (orgId, title, capacity, token) => {
      const res = await fetch(`${baseUrl}/api/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organization_id: orgId,
          title,
          description: `Description for ${title}`,
          category: 'Environment',
          event_date: '2026-11-25',
          start_time: '09:00:00',
          end_time: '12:00:00',
          location: 'City Green Park',
          address: '200 Park Way',
          capacity,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    // Opp 1A & 1B under Coordinator 1
    const opp1A_Id = await createOpp(org1Id, 'Tree Planting Initiative', 10, tokenCoord1);
    const opp1B_Id = await createOpp(org1Id, 'Riverbank Clean', 10, tokenCoord1);
    // Opp 2 under Coordinator 2
    const opp2_Id = await createOpp(org2Id, 'Coastal Bird Sanctuary Protection', 10, tokenCoord2);

    // Helper: volunteer signup
    const signupVolunteer = async (oppId, token) => {
      const res = await fetch(`${baseUrl}/api/opportunities/${oppId}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      return data.data.signup.id;
    };

    // Signups:
    // Alice signs up for Opp 1A and Opp 1B (under Coordinator 1)
    const signup1A_Alice = await signupVolunteer(opp1A_Id, tokenVol1);
    const signup1B_Alice = await signupVolunteer(opp1B_Id, tokenVol1);
    // Bob signs up for Opp 2 (under Coordinator 2)
    const signup2_Bob = await signupVolunteer(opp2_Id, tokenVol2);

    console.log(`${colors.yellow}Test entities prepared successfully.${colors.reset}\n`);

    // ================================================================
    // Group 1: Authentication & Format Validation (401 & 400)
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Format Validation${colors.reset}`);

    // Test 1: Unauthenticated request returns 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}`);
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated request returns 401 Unauthorized'
    );

    // Test 2: Invalid JWT returns 401 Unauthorized
    const invalidTokenRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}`, {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    assert(
      invalidTokenRes.status === 401,
      'Test 2: Invalid JWT returns 401 Unauthorized'
    );

    // Test 3: Invalid UUID format returns 400 Bad Request
    const invalidUuidRes = await fetch(`${baseUrl}/api/signups/not-a-valid-uuid`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const invalidUuidData = await invalidUuidRes.json();
    assert(
      invalidUuidRes.status === 400 && invalidUuidData.message.includes('valid UUID'),
      'Test 3: Invalid UUID format returns 400 Bad Request'
    );

    // Test 4: Non-existent signup UUID for volunteer returns 404 Not Found
    const nonExistentUuid = 'a0000000-0000-0000-0000-000000000000';
    const nonExistentVolRes = await fetch(`${baseUrl}/api/signups/${nonExistentUuid}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const nonExistentVolData = await nonExistentVolRes.json();
    assert(
      nonExistentVolRes.status === 404 && nonExistentVolData.message.includes('Signup not found'),
      'Test 4: Non-existent signup UUID for volunteer returns 404 Not Found'
    );

    // Test 5: Non-existent signup UUID for coordinator returns 404 Not Found
    const nonExistentCoordRes = await fetch(`${baseUrl}/api/signups/${nonExistentUuid}`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const nonExistentCoordData = await nonExistentCoordRes.json();
    assert(
      nonExistentCoordRes.status === 404 && nonExistentCoordData.message.includes('Signup not found'),
      'Test 5: Non-existent signup UUID for coordinator returns 404 Not Found'
    );

    // ================================================================
    // Group 2: Volunteer Authorization & Ownership Isolation
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Volunteer Authorization & Ownership Isolation${colors.reset}`);

    // Test 6: Volunteer 1 can retrieve their own signup (Signup 1A)
    const vol1OwnRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const vol1OwnData = await vol1OwnRes.json();
    assert(
      vol1OwnRes.status === 200 &&
        vol1OwnData.status === 'success' &&
        vol1OwnData.data?.signup?.id === signup1A_Alice,
      'Test 6: Volunteer can retrieve their own signup (200 OK)'
    );

    // Test 7: Volunteer response contains signup and opportunity fields
    const vol1Signup = vol1OwnData.data?.signup;
    assert(
      vol1Signup.volunteer_id === userVol1.id &&
        vol1Signup.opportunity_id === opp1A_Id &&
        vol1Signup.opportunity_title === 'Tree Planting Initiative' &&
        vol1Signup.status === 'REGISTERED' &&
        vol1Signup.created_at !== undefined,
      'Test 7: Volunteer response preserves required signup and opportunity details'
    );

    // Test 8: Volunteer 1 cannot retrieve Volunteer 2's signup (Signup 2) -> returns 404 Not Found
    const crossVolRes1 = await fetch(`${baseUrl}/api/signups/${signup2_Bob}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const crossVolData1 = await crossVolRes1.json();
    assert(
      crossVolRes1.status === 404 && crossVolData1.message.includes('Signup not found'),
      'Test 8: Volunteer cannot retrieve another volunteer signup (404 Not Found, preserving anti-enumeration)'
    );

    // Test 9: Volunteer 2 cannot retrieve Volunteer 1's signup (Signup 1A) -> returns 404 Not Found
    const crossVolRes2 = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}`, {
      headers: { Authorization: `Bearer ${tokenVol2}` },
    });
    assert(
      crossVolRes2.status === 404,
      'Test 9: Volunteer 2 cannot retrieve Volunteer 1 signup (404 Not Found)'
    );

    // ================================================================
    // Group 3: Coordinator Ownership & Detail Retrieval
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Coordinator Ownership & Detail Retrieval${colors.reset}`);

    // Test 10: Coordinator 1 can retrieve signup belonging to their own organization (Signup 1A)
    const coord1OwnRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const coord1OwnData = await coord1OwnRes.json();
    assert(
      coord1OwnRes.status === 200 &&
        coord1OwnData.status === 'success' &&
        coord1OwnData.data?.signup?.id === signup1A_Alice,
      'Test 10: Coordinator can retrieve signup from their own organization (200 OK)'
    );

    // Test 11: Coordinator response contains full management detail
    const coordSignup = coord1OwnData.data?.signup;
    assert(
      coordSignup.id === signup1A_Alice &&
        coordSignup.volunteer_id === userVol1.id &&
        coordSignup.volunteer_name === volunteer1.full_name &&
        coordSignup.volunteer_email === volunteer1.email &&
        coordSignup.opportunity_id === opp1A_Id &&
        coordSignup.opportunity_title === 'Tree Planting Initiative' &&
        coordSignup.opportunity_location === 'City Green Park' &&
        coordSignup.organization_id === org1Id &&
        coordSignup.status === 'REGISTERED' &&
        coordSignup.created_at !== undefined &&
        coordSignup.updated_at !== undefined,
      'Test 11: Coordinator response includes volunteer info, opportunity info, organization info, and timestamps'
    );

    // Test 12: Coordinator 1 can retrieve another signup belonging to their own organization (Signup 1B)
    const coord1SecondRes = await fetch(`${baseUrl}/api/signups/${signup1B_Alice}`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      coord1SecondRes.status === 200,
      'Test 12: Coordinator 1 can retrieve second signup from their own organization (200 OK)'
    );

    // Test 13: Coordinator 1 cannot retrieve signup from Coordinator 2's organization (Signup 2) -> 403 Forbidden
    const crossCoordRes1 = await fetch(`${baseUrl}/api/signups/${signup2_Bob}`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const crossCoordData1 = await crossCoordRes1.json();
    assert(
      crossCoordRes1.status === 403 &&
        crossCoordData1.message.includes('permission'),
      'Test 13: Coordinator 1 cannot retrieve signup from Coordinator 2 organization (403 Forbidden)'
    );

    // Test 14: Coordinator 2 cannot retrieve signup from Coordinator 1's organization (Signup 1A) -> 403 Forbidden
    const crossCoordRes2 = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}`, {
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const crossCoordData2 = await crossCoordRes2.json();
    assert(
      crossCoordRes2.status === 403 &&
        crossCoordData2.message.includes('permission'),
      'Test 14: Coordinator 2 cannot retrieve signup from Coordinator 1 organization (403 Forbidden)'
    );

    // ================================================================
    // Group 4: Anti-Spoofing & Security Verification
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Anti-Spoofing & Security Verification${colors.reset}`);

    // Test 15: Query parameter spoofing does not bypass authorization
    const spoofQueryRes = await fetch(
      `${baseUrl}/api/signups/${signup2_Bob}?coordinator_id=${userCoord2.id}&volunteer_id=${userVol2.id}`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    assert(
      spoofQueryRes.status === 403,
      'Test 15: Client-supplied ownership query parameters cannot bypass authorization (strictly uses JWT identity)'
    );

    // Test 16: Coordinator 2 attempting to spoof coordinator_id to access Coordinator 1's signup is rejected
    const spoofParamRes = await fetch(
      `${baseUrl}/api/signups/${signup1A_Alice}?coordinator_id=${userCoord1.id}&volunteer_id=${userVol1.id}`,
      {
        headers: { Authorization: `Bearer ${tokenCoord2}` },
      }
    );
    assert(
      spoofParamRes.status === 403,
      'Test 16: Coordinator 2 passing Coordinator 1 ID in query params cannot bypass authorization (403 Forbidden)'
    );

    // Test 17: Sensitive data protection: Volunteer response does NOT leak password or password_hash
    const rawVolStr = JSON.stringify(vol1OwnData);
    assert(
      !rawVolStr.includes('password') && !rawVolStr.includes('password_hash'),
      'Test 17: Volunteer response does NOT leak password or password_hash'
    );

    // Test 18: Sensitive data protection: Coordinator response does NOT leak password or password_hash
    const rawCoordStr = JSON.stringify(coord1OwnData);
    assert(
      !rawCoordStr.includes('password') && !rawCoordStr.includes('password_hash'),
      'Test 18: Coordinator response does NOT leak password or password_hash'
    );

    // ================================================================
    // Group 5: Regression & Non-Breakage of Days 17-27 Endpoints
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Regression & Non-Breakage of Existing Endpoints${colors.reset}`);

    // Test 19: Existing volunteer cancellation (PATCH /api/signups/:id/cancel) remains operational
    const volCancelRes = await fetch(`${baseUrl}/api/signups/${signup1B_Alice}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const volCancelData = await volCancelRes.json();
    assert(
      volCancelRes.status === 200 && volCancelData.data?.signup?.status === 'CANCELLED',
      'Test 19: Existing volunteer cancellation (PATCH /api/signups/:id/cancel) remains operational (200 OK)'
    );

    // Test 20: Coordinator signup status update to CANCELLED (Day 27) remains operational
    const coordCancelRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      coordCancelRes.status === 200,
      'Test 20: Day 27 PATCH /api/signups/:id/status to CANCELLED remains operational (200 OK)'
    );

    // Test 21: Coordinator signup status update to REGISTERED (Day 27) remains operational
    const coordRegRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });
    assert(
      coordRegRes.status === 200,
      'Test 21: Day 27 PATCH /api/signups/:id/status to REGISTERED remains operational (200 OK)'
    );

    // Test 22: Day 17 POST /api/organizations remains operational
    const regOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: `Regression Org Detail ${timestamp}`,
        description: 'Detail regression testing',
      }),
    });
    assert(
      regOrgRes.status === 201,
      'Test 22: Day 17 POST /api/organizations remains operational (201 Created)'
    );

    // Test 23: Day 18 POST /api/opportunities remains operational
    const regOppRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        organization_id: org1Id,
        title: 'Detail Regression Opp',
        description: 'Detail regression testing',
        category: 'Health',
        event_date: '2026-12-10',
        start_time: '10:00:00',
        end_time: '13:00:00',
        location: 'Hospital',
        address: '500 Health Blvd',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    assert(
      regOppRes.status === 201,
      'Test 23: Day 18 POST /api/opportunities remains operational (201 Created)'
    );

    // Test 24: Day 19 GET /api/signups/my remains operational
    const regMySignupsRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regMySignupsRes.status === 200,
      'Test 24: Day 19 GET /api/signups/my remains operational (200 OK)'
    );

    // Test 25: Day 20 POST /api/signups/:id/hours remains operational
    const regHoursRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4.0, status: 'RECORDED' }),
    });
    const regHoursData = await regHoursRes.json();
    const regHourId = regHoursData.data?.volunteer_hours?.id;
    assert(
      regHoursRes.status === 201 && regHourId !== undefined,
      'Test 25: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 26: Day 21 GET /api/hours/my remains operational
    const regMyHoursRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regMyHoursRes.status === 200,
      'Test 26: Day 21 GET /api/hours/my remains operational (200 OK)'
    );

    // Test 27: Day 22 PATCH /api/hours/:id/status remains operational
    const regPatchHourRes = await fetch(`${baseUrl}/api/hours/${regHourId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      regPatchHourRes.status === 200,
      'Test 27: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 28: Day 23 GET /api/hours/my/summary remains operational
    const regSummaryRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regSummaryRes.status === 200,
      'Test 28: Day 23 GET /api/hours/my/summary remains operational (200 OK)'
    );

    // Test 29: Day 24 & 25 GET /api/hours/organization/opportunities with date filter remains operational
    const regOppSummaryRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-01-01&to_date=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    assert(
      regOppSummaryRes.status === 200,
      'Test 29: Day 24 & 25 GET /api/hours/organization/opportunities with date filter remains operational (200 OK)'
    );

    // Test 30: Day 26 GET /api/hours/my?from_date=2026-01-01&to_date=2026-12-31 remains operational
    const regDateHoursRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2026-01-01&to_date=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      regDateHoursRes.status === 200,
      'Test 30: Day 26 GET /api/hours/my date-based retrieval remains operational (200 OK)'
    );

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    try {
      await cleanupDatabase();
    } catch (e) {
      console.error('Error during cleanup:', e);
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log(`\n=============================================================`);
  console.log(`  DAY 28 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
