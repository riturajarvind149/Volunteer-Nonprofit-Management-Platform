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
  console.log(`  DAY 22: VOLUNTEER HOURS STATUS MANAGEMENT TEST SUITE       `);
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
    full_name: 'Status Coordinator One',
    email: `coord1.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Status Coordinator Two',
    email: `coord2.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Status Volunteer Alice',
    email: `vol1.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator1.email,
    coordinator2.email,
    volunteer1.email,
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
    await registerUser(volunteer1);

    // Login users
    const { token: tokenCoord1, user: userCoord1 } = await loginUser(coordinator1.email, coordinator1.password);
    const { token: tokenCoord2, user: userCoord2 } = await loginUser(coordinator2.email, coordinator2.password);
    const { token: tokenVol1, user: userVol1 } = await loginUser(volunteer1.email, volunteer1.password);

    // Setup:
    // 1. Coordinator 1 creates Org 1
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Coord 1 Community Care',
        description: 'Org 1 for status management testing',
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
        name: 'Coord 2 Wildlife Rescue',
        description: 'Org 2 for status management testing',
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
        title: 'Community Food Drive',
        description: 'Distributing food items',
        category: 'Hunger & Food',
        event_date: '2026-11-10',
        start_time: '10:00:00',
        end_time: '14:00:00',
        location: 'Community Center',
        address: '100 Food St',
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
        title: 'Animal Shelter Support',
        description: 'Feeding and caring for animals',
        category: 'Animal Welfare',
        event_date: '2026-11-12',
        start_time: '09:00:00',
        end_time: '13:00:00',
        location: 'Animal Shelter',
        address: '200 Shelter Way',
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

    // 7. Coordinator 1 records initial hours (4.0 hours, status: RECORDED) for signup 1
    const hours1Res = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4.0, status: 'RECORDED' }),
    });
    const hours1Data = await hours1Res.json();
    const hours1Id = hours1Data.data.volunteer_hours.id;

    // 8. Coordinator 2 records initial hours (6.5 hours, status: PENDING) for signup 2
    const hours2Res = await fetch(`${baseUrl}/api/signups/${signup2Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({ hours: 6.5, status: 'PENDING' }),
    });
    const hours2Data = await hours2Res.json();
    const hours2Id = hours2Data.data.volunteer_hours.id;

    console.log(`Test setup completed with 2 recorded hours entries across 2 organizations.\n`);

    // ================================================================
    // Group 1: Authentication & RBAC Authorization
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & RBAC Authorization${colors.reset}`);

    // Test 1: Unauthenticated request returns 401
    const unauthRes = await fetch(`${baseUrl}/api/hours/${hours1Id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated PATCH /api/hours/:id/status returns 401 Unauthorized'
    );

    // Test 2: Volunteer attempting status update returns 403 Forbidden
    const volRes = await fetch(`${baseUrl}/api/hours/${hours1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      volRes.status === 403,
      'Test 2: Volunteer attempting PATCH /api/hours/:id/status returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Input Validation (UUID, Missing/Invalid Status)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Input Validation (UUID, Status)${colors.reset}`);

    // Test 3: Invalid UUID format returns 400
    const invalidUuidRes = await fetch(`${baseUrl}/api/hours/invalid-uuid-format/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      invalidUuidRes.status === 400,
      'Test 3: Invalid UUID format returns 400 Bad Request'
    );

    // Test 4: Missing status in body returns 400
    const missingStatusRes = await fetch(`${baseUrl}/api/hours/${hours1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({}),
    });
    assert(
      missingStatusRes.status === 400,
      'Test 4: Missing status field in request body returns 400 Bad Request'
    );

    // Test 5: Invalid status enum returns 400
    const invalidStatusRes = await fetch(`${baseUrl}/api/hours/${hours1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'APPROVED_CUSTOM' }),
    });
    assert(
      invalidStatusRes.status === 400,
      'Test 5: Unsupported status enum returns 400 Bad Request'
    );

    // ================================================================
    // Group 3: Resource Existence & Organization Ownership (404 vs 403)
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Resource Existence & Organization Ownership${colors.reset}`);

    // Test 6: Non-existent hours record UUID returns 404
    const nonExistentId = '00000000-0000-0000-0000-000000000000';
    const notFoundRes = await fetch(`${baseUrl}/api/hours/${nonExistentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      notFoundRes.status === 404,
      'Test 6: Non-existent hours UUID returns 404 Not Found'
    );

    // Test 7: Coordinator 1 attempts to update hours belonging to Coordinator 2's organization returns 403
    const crossOrgRes = await fetch(`${baseUrl}/api/hours/${hours2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      crossOrgRes.status === 403,
      "Test 7: Coordinator cannot update hours belonging to another coordinator's organization (403 Forbidden)"
    );

    // ================================================================
    // Group 4: Successful Status Update & Immutability Verification
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Successful Status Update & Immutability Verification${colors.reset}`);

    // Test 8: Coordinator 1 updates own organization's hours from RECORDED to VERIFIED
    const updateRes = await fetch(`${baseUrl}/api/hours/${hours1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        status: 'VERIFIED',
        hours: 999.0, // Tampering attempt: hours must NOT be updated
        recorded_by: userCoord2.id, // Tampering attempt: recorded_by must NOT change
      }),
    });
    const updateData = await updateRes.json();
    const updatedRecord = updateData.data?.volunteer_hours;

    assert(
      updateRes.status === 200 && updateData.status === 'success' && updatedRecord !== undefined,
      'Test 8: Coordinator successfully updates volunteer hours status with HTTP 200 OK'
    );

    // Test 9: Status changed correctly
    assert(
      updatedRecord?.status === 'VERIFIED',
      `Test 9: Status in returned response is VERIFIED (${updatedRecord?.status})`
    );

    // Test 10: Hours value remained completely unchanged (4.0, NOT 999)
    assert(
      parseFloat(updatedRecord?.hours) === 4.0,
      `Test 10: Hours value remained unchanged (${updatedRecord?.hours} === 4.00)`
    );

    // Test 11: recorded_by remained completely unchanged (userCoord1.id)
    assert(
      updatedRecord?.recorded_by === userCoord1.id,
      `Test 11: recorded_by was not modified by client tampering (${updatedRecord?.recorded_by})`
    );

    // Test 12: Database row confirms updated status and updated_at
    const dbCheck = await pool.query('SELECT * FROM volunteer_hours WHERE id = $1', [hours1Id]);
    const dbRow = dbCheck.rows[0];
    assert(
      dbRow.status === 'VERIFIED' &&
        parseFloat(dbRow.hours) === 4.0 &&
        dbRow.recorded_by === userCoord1.id &&
        new Date(dbRow.updated_at).getTime() >= new Date(dbRow.created_at).getTime(),
      'Test 12: PostgreSQL row confirms status is VERIFIED, hours unchanged, and updated_at refreshed'
    );

    // Test 13: Coordinator can update status to PENDING
    const revertRes = await fetch(`${baseUrl}/api/hours/${hours1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'PENDING' }),
    });
    const revertData = await revertRes.json();
    assert(
      revertRes.status === 200 && revertData.data?.volunteer_hours?.status === 'PENDING',
      'Test 13: Coordinator can update status to PENDING'
    );

    // Test 14: Coordinator 2 updates their own organization's hours from PENDING to RECORDED
    const coord2UpdateRes = await fetch(`${baseUrl}/api/hours/${hours2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({ status: 'RECORDED' }),
    });
    const coord2UpdateData = await coord2UpdateRes.json();
    assert(
      coord2UpdateRes.status === 200 && coord2UpdateData.data?.volunteer_hours?.status === 'RECORDED',
      "Test 14: Coordinator 2 successfully updates their own organization's hours"
    );

    // ================================================================
    // Group 5: Regression & Retrieval Continuity
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Regression & Retrieval Continuity${colors.reset}`);

    // Test 15: Volunteer retrieval GET /api/hours/my reflects updated status
    const volHoursCheckRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const volHoursCheckData = await volHoursCheckRes.json();
    const volList = volHoursCheckData.data?.volunteer_hours;
    const volRecord1 = volList?.find((r) => r.id === hours1Id);
    assert(
      volHoursCheckRes.status === 200 && volRecord1?.status === 'PENDING',
      'Test 15: GET /api/hours/my reflects the updated status for the volunteer'
    );

    // Test 16: Coordinator retrieval GET /api/hours/organization reflects updated status
    const coordHoursCheckRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const coordHoursCheckData = await coordHoursCheckRes.json();
    const coordList = coordHoursCheckData.data?.volunteer_hours;
    const coordRecord2 = coordList?.find((r) => r.id === hours2Id);
    assert(
      coordHoursCheckRes.status === 200 && coordRecord2?.status === 'RECORDED',
      'Test 16: GET /api/hours/organization reflects updated status for coordinator'
    );

    // Test 17: Existing hours-recording functionality still operational (POST /api/signups/:id/hours)
    const newRecordRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 2.0, status: 'RECORDED' }),
    });
    assert(
      newRecordRes.status === 201,
      'Test 17: Existing POST /api/signups/:signupId/hours remains operational (201 Created)'
    );

    // Test 18: Sensitive fields not exposed
    const updateJsonStr = JSON.stringify(updateData);
    assert(
      !updateJsonStr.includes('password') && !updateJsonStr.includes('password_hash'),
      'Test 18: Response does NOT leak password or password_hash'
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
  console.log(`  DAY 22 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
