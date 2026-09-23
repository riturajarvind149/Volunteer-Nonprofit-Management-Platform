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
  console.log(`  DAY 20: VOLUNTEER HOURS MANAGEMENT FOUNDATION TEST SUITE   `);
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
    full_name: 'Hours Coordinator One',
    email: `coord1.hours.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Hours Coordinator Two',
    email: `coord2.hours.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Hours Volunteer Alice',
    email: `vol1.hours.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator1.email,
    coordinator2.email,
    volunteer1.email,
  ];

  const cleanupDatabase = async () => {
    // Delete volunteer_hours, signups, opportunities, organizations, users
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
    await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [testEmails]);
  };

  let tokenCoord1;
  let tokenCoord2;
  let tokenVol1;

  let coord1Id;
  let coord2Id;
  let vol1Id;

  let activeSignupId;
  let cancelledSignupId;
  let coord2SignupId;

  try {
    await cleanupDatabase();

    const registerUser = async (user) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      return await res.json();
    };

    const loginUser = async (email, password) => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return await res.json();
    };

    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(volunteer1);

    const coord1Login = await loginUser(coordinator1.email, coordinator1.password);
    tokenCoord1 = coord1Login.data.token;
    coord1Id = coord1Login.data.user.id;

    const coord2Login = await loginUser(coordinator2.email, coordinator2.password);
    tokenCoord2 = coord2Login.data.token;
    coord2Id = coord2Login.data.user.id;

    const vol1Login = await loginUser(volunteer1.email, volunteer1.password);
    tokenVol1 = vol1Login.data.token;
    vol1Id = vol1Login.data.user.id;

    // Create Org 1 for Coordinator 1
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: `Hours Org One ${timestamp}`,
        description: 'Org for coordinator 1',
      }),
    });
    const org1Data = await org1Res.json();
    const org1Id = org1Data.data.organization.id;

    // Create Org 2 for Coordinator 2
    const org2Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        name: `Hours Org Two ${timestamp}`,
        description: 'Org for coordinator 2',
      }),
    });
    const org2Data = await org2Res.json();
    const org2Id = org2Data.data.organization.id;

    // Create Opportunities for Org 1
    const createOpp = async (token, orgId, title) => {
      const res = await fetch(`${baseUrl}/api/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organization_id: orgId,
          title,
          event_date: '2026-11-20',
          start_time: '09:00:00',
          end_time: '13:00:00',
          location: 'Community Center',
          capacity: 10,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    const opp1Id = await createOpp(tokenCoord1, org1Id, 'Active Cleanup');
    const oppCancelledId = await createOpp(tokenCoord1, org1Id, 'Cancelled Cleanup Event');
    const opp2Id = await createOpp(tokenCoord2, org2Id, 'Coord 2 Opportunity');

    // Sign up volunteer 1 for opp1Id
    const signup1Res = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const signup1Data = await signup1Res.json();
    activeSignupId = signup1Data.data.signup.id;

    // Sign up volunteer 1 for oppCancelledId and cancel it
    const signupCancelRes = await fetch(`${baseUrl}/api/opportunities/${oppCancelledId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const signupCancelData = await signupCancelRes.json();
    cancelledSignupId = signupCancelData.data.signup.id;

    await fetch(`${baseUrl}/api/signups/${cancelledSignupId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });

    // Sign up volunteer 1 for opp2Id (owned by Coordinator 2)
    const signup2Res = await fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const signup2Data = await signup2Res.json();
    coord2SignupId = signup2Data.data.signup.id;

    console.log(`${colors.yellow}Test entities created successfully.${colors.reset}\n`);

    // ================================================================
    // Group 1: Authentication & Authorization (401 & 403)
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization${colors.reset}`);

    // Test 1: Missing JWT returns 401
    const missingJwtRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: 4 }),
    });
    assert(
      missingJwtRes.status === 401,
      'Test 1: Missing JWT returns 401 Unauthorized'
    );

    // Test 2: Invalid JWT returns 401
    const invalidJwtRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.payload',
      },
      body: JSON.stringify({ hours: 4 }),
    });
    assert(
      invalidJwtRes.status === 401,
      'Test 2: Invalid JWT returns 401 Unauthorized'
    );

    // Test 3: Volunteer attempts to record hours returns 403 Forbidden
    const volRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
      body: JSON.stringify({ hours: 4 }),
    });
    assert(
      volRes.status === 403,
      'Test 3: Volunteer attempting to record hours returns 403 Forbidden (RBAC enforced)'
    );

    // ================================================================
    // Group 2: Validation of Parameters and Request Body
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Input Validation (UUID, Hours, Status)${colors.reset}`);

    // Test 4: Invalid signup UUID returns 400 Bad Request
    const invalidUuidRes = await fetch(`${baseUrl}/api/signups/not-a-valid-uuid/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4 }),
    });
    assert(
      invalidUuidRes.status === 400,
      'Test 4: Invalid signup UUID returns 400 Bad Request'
    );

    // Test 5: Missing hours field returns 400 Bad Request
    const missingHoursRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({}),
    });
    assert(
      missingHoursRes.status === 400,
      'Test 5: Missing required hours field returns 400 Bad Request'
    );

    // Test 6: Non-numeric hours value returns 400 Bad Request
    const stringHoursRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 'invalid_number' }),
    });
    assert(
      stringHoursRes.status === 400,
      'Test 6: Non-numeric hours string returns 400 Bad Request'
    );

    // Test 7: Negative hours value returns 400 Bad Request
    const negHoursRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: -3.5 }),
    });
    assert(
      negHoursRes.status === 400,
      'Test 7: Negative hours value returns 400 Bad Request'
    );

    // Test 8: Hours exceeding 2 decimal places returns 400 Bad Request
    const precisionHoursRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4.125 }),
    });
    assert(
      precisionHoursRes.status === 400,
      'Test 8: Hours with > 2 decimal places returns 400 Bad Request'
    );

    // Test 9: Hours exceeding 9999.99 returns 400 Bad Request
    const maxHoursRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 10000 }),
    });
    assert(
      maxHoursRes.status === 400,
      'Test 9: Hours exceeding 9999.99 returns 400 Bad Request'
    );

    // Test 10: Invalid status enum returns 400 Bad Request
    const invalidStatusRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4, status: 'INVALID_STATUS' }),
    });
    assert(
      invalidStatusRes.status === 400,
      'Test 10: Invalid status enum returns 400 Bad Request'
    );

    // ================================================================
    // Group 3: Resource Ownership & State Checks
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Resource Existence & Coordinator Ownership${colors.reset}`);

    // Test 11: Non-existent signup UUID returns 404 Not Found
    const nonExistentSignupId = 'd0000000-0000-0000-0000-000000000000';
    const nonExistentRes = await fetch(`${baseUrl}/api/signups/${nonExistentSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4 }),
    });
    assert(
      nonExistentRes.status === 404,
      'Test 11: Non-existent signup UUID returns 404 Not Found'
    );

    // Test 12: Cannot record hours for CANCELLED signup (400 Bad Request)
    const cancelledSignupRes = await fetch(`${baseUrl}/api/signups/${cancelledSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4 }),
    });
    assert(
      cancelledSignupRes.status === 400,
      'Test 12: Cannot record hours for a CANCELLED signup returns 400 Bad Request'
    );

    // Test 13: Coordinator cannot record hours for another coordinator's signup (403 Forbidden)
    const crossCoordRes = await fetch(`${baseUrl}/api/signups/${coord2SignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 5 }),
    });
    assert(
      crossCoordRes.status === 403,
      'Test 13: Coordinator cannot record hours for another coordinator signup returns 403 Forbidden (Ownership Isolation)'
    );

    // ================================================================
    // Group 4: Successful Hours Recording & Database Verification
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Successful Hours Recording & Anti-Spoofing${colors.reset}`);

    // Test 14: Coordinator records hours successfully (201 Created)
    const validRecordRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        hours: 4.5,
        recorded_by: coord2Id, // Spoofing attempt: must be stripped and overwritten with req.user.id
      }),
    });
    const validRecordData = await validRecordRes.json();
    assert(
      validRecordRes.status === 201 &&
        validRecordData.status === 'success' &&
        validRecordData.data?.volunteer_hours?.id !== undefined,
      'Test 14: Coordinator successfully records volunteer hours with HTTP 201 Created'
    );

    const recordObj = validRecordData.data?.volunteer_hours;

    // Test 15: Hours value stored correctly
    assert(
      parseFloat(recordObj.hours) === 4.5,
      `Test 15: Hours value stored correctly (${recordObj.hours})`
    );

    // Test 16: Status defaults to RECORDED
    assert(
      recordObj.status === 'RECORDED',
      `Test 16: Status defaults to RECORDED (${recordObj.status})`
    );

    // Test 17: recorded_by strictly bound to authenticated coordinator (anti-spoofing)
    assert(
      recordObj.recorded_by === coord1Id,
      `Test 17: recorded_by matches authenticated coordinator ID (${recordObj.recorded_by})`
    );

    // Test 18: Database row matches returned record
    const dbRow = await pool.query(
      `SELECT * FROM volunteer_hours WHERE id = $1`,
      [recordObj.id]
    );
    assert(
      dbRow.rows.length === 1 &&
        dbRow.rows[0].signup_id === activeSignupId &&
        parseFloat(dbRow.rows[0].hours) === 4.5 &&
        dbRow.rows[0].recorded_by === coord1Id,
      'Test 18: Database query confirms volunteer_hours record persisted with correct values'
    );

    // Test 19: Coordinator can specify custom valid status (e.g. VERIFIED)
    const customStatusRes = await fetch(`${baseUrl}/api/signups/${activeSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        hours: 2.25,
        status: 'VERIFIED',
      }),
    });
    const customStatusData = await customStatusRes.json();
    assert(
      customStatusRes.status === 201 &&
        customStatusData.data?.volunteer_hours?.status === 'VERIFIED' &&
        parseFloat(customStatusData.data?.volunteer_hours?.hours) === 2.25,
      'Test 19: Coordinator can record hours with custom valid status (VERIFIED)'
    );

    // Test 20: Coordinator 2 can record hours for their own signup
    const coord2RecordRes = await fetch(`${baseUrl}/api/signups/${coord2SignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        hours: 6.0,
      }),
    });
    assert(
      coord2RecordRes.status === 201,
      'Test 20: Coordinator 2 can record hours for their own opportunity signup (201 Created)'
    );

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    await cleanupDatabase();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log(`\n=============================================================`);
  console.log(`  DAY 20 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
