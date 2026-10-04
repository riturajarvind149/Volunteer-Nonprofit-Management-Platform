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
  console.log(`  DAY 27: COORDINATOR SIGNUP STATUS MANAGEMENT TEST SUITE    `);
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
    full_name: 'Coordinator One Day 27',
    email: `coord1.signup.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Coordinator Two Day 27',
    email: `coord2.signup.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Volunteer Alice Day 27',
    email: `vol1.signup.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Volunteer Bob Day 27',
    email: `vol2.signup.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer3 = {
    full_name: 'Volunteer Charlie Day 27',
    email: `vol3.signup.status.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator1.email,
    coordinator2.email,
    volunteer1.email,
    volunteer2.email,
    volunteer3.email,
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
    const userVol3Data = await registerUser(volunteer3);

    const userCoord1 = userCoord1Data.data.user;
    const userCoord2 = userCoord2Data.data.user;
    const userVol1 = userVol1Data.data.user;
    const userVol2 = userVol2Data.data.user;
    const userVol3 = userVol3Data.data.user;

    const tokenCoord1 = (await loginUser(coordinator1.email, coordinator1.password)).data.token;
    const tokenCoord2 = (await loginUser(coordinator2.email, coordinator2.password)).data.token;
    const tokenVol1 = (await loginUser(volunteer1.email, volunteer1.password)).data.token;
    const tokenVol2 = (await loginUser(volunteer2.email, volunteer2.password)).data.token;
    const tokenVol3 = (await loginUser(volunteer3.email, volunteer3.password)).data.token;

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

    const org1Id = await createOrg(`Org One ${timestamp}`, tokenCoord1);
    const org2Id = await createOrg(`Org Two ${timestamp}`, tokenCoord2);

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
          event_date: '2026-11-20',
          start_time: '09:00:00',
          end_time: '12:00:00',
          location: 'Community Park',
          address: '100 Main St',
          capacity,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    // Opp 1: Standard capacity 5 under Org 1 (Coordinator 1)
    const opp1Id = await createOpp(org1Id, 'Park Tree Planting', 5, tokenCoord1);
    // Opp 2: Single capacity 1 under Org 1 (Coordinator 1) for capacity tests
    const oppSingleCapId = await createOpp(org1Id, 'Solo Drone Surveyor', 1, tokenCoord1);
    // Opp 3: Opp under Org 2 (Coordinator 2) for multi-tenant isolation
    const opp2Id = await createOpp(org2Id, 'Beach Restoration', 5, tokenCoord2);

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

    // Create initial signups
    const signup1_Alice = await signupVolunteer(opp1Id, tokenVol1);
    const signup2_Bob = await signupVolunteer(opp1Id, tokenVol2);
    const signup3_Coord2 = await signupVolunteer(opp2Id, tokenVol3);

    console.log(`${colors.yellow}Test entities prepared successfully.${colors.reset}\n`);

    // ================================================================
    // Group 1: Authentication & Role Authorization (401 & 403)
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated PATCH /api/signups/:id/status returns 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated request returns 401 Unauthorized'
    );

    // Test 2: Invalid JWT returns 401 Unauthorized
    const invalidTokenRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.value',
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      invalidTokenRes.status === 401,
      'Test 2: Invalid JWT token returns 401 Unauthorized'
    );

    // Test 3: Volunteer accessing PATCH /api/signups/:id/status returns 403 Forbidden
    const volAccessRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      volAccessRes.status === 403,
      'Test 3: Volunteer accessing coordinator status endpoint returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Validation of UUID, Status, and Field Sanitization (400 Bad Request)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Input Validation (UUID & Status)${colors.reset}`);

    // Test 4: Invalid signup UUID returns 400 Bad Request
    const invalidUuidRes = await fetch(`${baseUrl}/api/signups/not-a-valid-uuid/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const invalidUuidData = await invalidUuidRes.json();
    assert(
      invalidUuidRes.status === 400 && invalidUuidData.message.includes('valid UUID'),
      'Test 4: Invalid signup UUID returns 400 Bad Request'
    );

    // Test 5: Missing status body returns 400 Bad Request
    const missingStatusRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({}),
    });
    const missingStatusData = await missingStatusRes.json();
    assert(
      missingStatusRes.status === 400 && missingStatusData.message.includes('Status is required'),
      'Test 5: Missing status field returns 400 Bad Request ("Status is required")'
    );

    // Test 6: Empty string status returns 400 Bad Request
    const emptyStatusRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: '   ' }),
    });
    assert(
      emptyStatusRes.status === 400,
      'Test 6: Whitespace/empty status string returns 400 Bad Request'
    );

    // Test 7: Null status returns 400 Bad Request
    const nullStatusRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: null }),
    });
    assert(
      nullStatusRes.status === 400,
      'Test 7: Null status returns 400 Bad Request'
    );

    // Test 8: Non-string status returns 400 Bad Request
    const nonStringStatusRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 12345 }),
    });
    assert(
      nonStringStatusRes.status === 400,
      'Test 8: Non-string status returns 400 Bad Request'
    );

    // Test 9: Unsupported status value (e.g. PENDING) returns 400 Bad Request
    const pendingStatusRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'PENDING' }),
    });
    const pendingStatusData = await pendingStatusRes.json();
    assert(
      pendingStatusRes.status === 400 && pendingStatusData.message.includes('REGISTERED, CANCELLED'),
      'Test 9: Unsupported status "PENDING" returns 400 Bad Request (only REGISTERED, CANCELLED allowed)'
    );

    // Test 10: Unsupported status value (e.g. COMPLETED) returns 400 Bad Request
    const completedStatusRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(
      completedStatusRes.status === 400,
      'Test 10: Unsupported status "COMPLETED" returns 400 Bad Request'
    );

    // Test 11: Non-existent signup UUID returns 404 Not Found
    const nonExistentUuid = 'a0000000-0000-0000-0000-000000000000';
    const nonExistentRes = await fetch(`${baseUrl}/api/signups/${nonExistentUuid}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const nonExistentData = await nonExistentRes.json();
    assert(
      nonExistentRes.status === 404 && nonExistentData.message.includes('Signup not found'),
      'Test 11: Non-existent signup returns 404 Not Found'
    );

    // ================================================================
    // Group 3: Coordinator Updating Status to CANCELLED & Data Integrity
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Status Update to CANCELLED & Immutability${colors.reset}`);

    // Capture pre-update record from DB
    const preDbRes = await pool.query(`SELECT * FROM signups WHERE id = $1`, [signup1_Alice]);
    const preRow = preDbRes.rows[0];

    // Test 12: Coordinator can update own organization's signup to CANCELLED
    const cancelRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const cancelData = await cancelRes.json();
    assert(
      cancelRes.status === 200 &&
        cancelData.status === 'success' &&
        cancelData.data?.signup?.status === 'CANCELLED',
      'Test 12: Coordinator successfully updates own organization signup to CANCELLED (200 OK)'
    );

    // Test 13: Returned response contains correct payload structure
    const updatedSignup = cancelData.data?.signup;
    assert(
      updatedSignup.id === signup1_Alice &&
        updatedSignup.volunteer_id === userVol1.id &&
        updatedSignup.opportunity_id === opp1Id &&
        updatedSignup.status === 'CANCELLED' &&
        updatedSignup.created_at !== undefined &&
        updatedSignup.updated_at !== undefined,
      'Test 13: Response contains complete signup structure (id, volunteer_id, opportunity_id, status, timestamps)'
    );

    // Test 14: Only status and updated_at are modified; volunteer_id, opportunity_id, created_at remain intact
    const postDbRes = await pool.query(`SELECT * FROM signups WHERE id = $1`, [signup1_Alice]);
    const postRow = postDbRes.rows[0];
    assert(
      postRow.id === preRow.id &&
        postRow.volunteer_id === preRow.volunteer_id &&
        postRow.opportunity_id === preRow.opportunity_id &&
        new Date(postRow.created_at).getTime() === new Date(preRow.created_at).getTime() &&
        postRow.status === 'CANCELLED' &&
        new Date(postRow.updated_at).getTime() >= new Date(preRow.updated_at).getTime(),
      'Test 14: Database confirms only status and updated_at are modified; other fields intact'
    );

    // Test 15: Status normalization: lowercase 'cancelled' is normalized to 'CANCELLED'
    const lowerCancelRes = await fetch(`${baseUrl}/api/signups/${signup2_Bob}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const lowerCancelData = await lowerCancelRes.json();
    assert(
      lowerCancelRes.status === 200 &&
        lowerCancelData.data?.signup?.status === 'CANCELLED',
      'Test 15: Lowercase "cancelled" is accepted and normalized to "CANCELLED"'
    );

    // ================================================================
    // Group 4: Coordinator Updating CANCELLED Signup Back to REGISTERED & Capacity Protection
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Reactivation to REGISTERED & Capacity Protection${colors.reset}`);

    // Test 16: Coordinator can update a cancelled signup back to REGISTERED when capacity is available (200 OK)
    const reactivateRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });
    const reactivateData = await reactivateRes.json();
    assert(
      reactivateRes.status === 200 &&
        reactivateData.data?.signup?.status === 'REGISTERED',
      'Test 16: Coordinator successfully updates a CANCELLED signup back to REGISTERED when capacity allows'
    );

    // Test 17: Normalization: lowercase 'registered' is accepted and normalized
    const lowerRegRes = await fetch(`${baseUrl}/api/signups/${signup2_Bob}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'registered' }),
    });
    const lowerRegData = await lowerRegRes.json();
    assert(
      lowerRegRes.status === 200 &&
        lowerRegData.data?.signup?.status === 'REGISTERED',
      'Test 17: Lowercase "registered" is accepted and normalized to "REGISTERED"'
    );

    // Test 18: Capacity Protection: Reactivating when opportunity capacity is reached
    // Setup for capacity test:
    // oppSingleCapId has capacity = 1
    // Volunteer Alice signs up -> fills capacity 1/1
    const singleSignup_Alice = await signupVolunteer(oppSingleCapId, tokenVol1);

    // Coordinator cancels Alice's signup -> capacity becomes 0/1 active
    await fetch(`${baseUrl}/api/signups/${singleSignup_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });

    // Volunteer Bob signs up -> fills capacity 1/1
    const singleSignup_Bob = await signupVolunteer(oppSingleCapId, tokenVol2);

    // Now opportunity is full (Bob is REGISTERED).
    // Coordinator attempts to reactivate Alice's CANCELLED signup -> must fail with 409 Conflict
    const overCapacityRes = await fetch(`${baseUrl}/api/signups/${singleSignup_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });
    const overCapacityData = await overCapacityRes.json();
    assert(
      overCapacityRes.status === 409 &&
        overCapacityData.message.includes('maximum capacity'),
      'Test 18: Reactivating CANCELLED signup fails with 409 Conflict when opportunity capacity is reached'
    );

    // ================================================================
    // Group 5: Multi-Tenant Ownership Isolation & Anti-Spoofing
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Multi-Tenant Ownership Isolation & Anti-Spoofing${colors.reset}`);

    // Test 19: Coordinator 1 cannot modify signup belonging to Coordinator 2's organization (403 Forbidden)
    const crossCoordRes1 = await fetch(`${baseUrl}/api/signups/${signup3_Coord2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const crossCoordData1 = await crossCoordRes1.json();
    assert(
      crossCoordRes1.status === 403 &&
        crossCoordData1.message.includes('permission'),
      'Test 19: Coordinator 1 cannot update signup belonging to Coordinator 2 (403 Forbidden)'
    );

    // Test 20: Coordinator 2 cannot modify signup belonging to Coordinator 1's organization (403 Forbidden)
    const crossCoordRes2 = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      crossCoordRes2.status === 403,
      'Test 20: Coordinator 2 cannot update signup belonging to Coordinator 1 (403 Forbidden)'
    );

    // Test 21: Anti-spoofing: Client-supplied IDs in body are stripped and cannot override JWT ownership
    const spoofBodyRes = await fetch(`${baseUrl}/api/signups/${signup3_Coord2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`, // Coordinator 1 sends coordinator_id of Coordinator 2
      },
      body: JSON.stringify({
        status: 'CANCELLED',
        coordinator_id: userCoord2.id,
        organization_id: org2Id,
        opportunity_id: opp2Id,
        volunteer_id: userVol3.id,
      }),
    });
    assert(
      spoofBodyRes.status === 403,
      'Test 21: Body spoofing attempt rejected; coordinator identity derived strictly from JWT'
    );

    // Test 22: Sensitive data protection: response does NOT expose password or password_hash
    const rawResStr = JSON.stringify(cancelData);
    assert(
      !rawResStr.includes('password') && !rawResStr.includes('password_hash'),
      'Test 22: Response payload does NOT leak password or password_hash'
    );

    // ================================================================
    // Group 6: Interaction with Capacity & Volunteer Cancellation Behavior
    // ================================================================
    console.log(`\n${colors.bold}Group 6: Interaction with Capacity & Volunteer Cancellation${colors.reset}`);

    // Test 23: Volunteer cancellation endpoint PATCH /api/signups/:id/cancel still works
    const volCancelRes = await fetch(`${baseUrl}/api/signups/${singleSignup_Bob}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol2}`,
      },
    });
    const volCancelData = await volCancelRes.json();
    assert(
      volCancelRes.status === 200 &&
        volCancelData.data?.signup?.status === 'CANCELLED',
      'Test 23: Existing volunteer cancellation endpoint (PATCH /api/signups/:id/cancel) remains fully functional'
    );

    // Test 24: Opportunity capacity logic properly frees slot when coordinator cancels
    // Alice's signup on single-capacity opp was CANCELLED earlier; Bob cancelled too.
    // Volunteer Charlie can now sign up for the free slot!
    const charlieSignupId = await signupVolunteer(oppSingleCapId, tokenVol3);
    assert(
      charlieSignupId !== undefined,
      'Test 24: Capacity logic properly treats CANCELLED signups as non-active; new volunteer signs up'
    );

    // ================================================================
    // Group 7: Regression & Non-Breakage of Existing Endpoints (Days 17-26)
    // ================================================================
    console.log(`\n${colors.bold}Group 7: Regression & Non-Breakage of Days 17-26 Endpoints${colors.reset}`);

    // Test 25: Day 17 POST /api/organizations remains operational
    const regOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: `Regression Org ${timestamp}`,
        description: 'Regression testing',
      }),
    });
    assert(
      regOrgRes.status === 201,
      'Test 25: Day 17 POST /api/organizations remains operational (201 Created)'
    );

    // Test 26: Day 18 POST /api/opportunities remains operational
    const regOppRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        organization_id: org1Id,
        title: 'Regression Opp',
        description: 'Regression testing',
        category: 'Education',
        event_date: '2026-12-01',
        start_time: '10:00:00',
        end_time: '14:00:00',
        location: 'Library',
        address: '10 Library Way',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    assert(
      regOppRes.status === 201,
      'Test 26: Day 18 POST /api/opportunities remains operational (201 Created)'
    );

    // Test 27: Day 19 GET /api/signups/my remains operational
    const regMySignupsRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regMySignupsRes.status === 200,
      'Test 27: Day 19 GET /api/signups/my remains operational (200 OK)'
    );

    // Test 28: Day 20 POST /api/signups/:id/hours remains operational
    const regHoursRes = await fetch(`${baseUrl}/api/signups/${signup1_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 3.5, status: 'RECORDED' }),
    });
    const regHoursData = await regHoursRes.json();
    const regHourId = regHoursData.data?.volunteer_hours?.id;
    assert(
      regHoursRes.status === 201 && regHourId !== undefined,
      'Test 28: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 29: Day 21 GET /api/hours/my remains operational
    const regMyHoursRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regMyHoursRes.status === 200,
      'Test 29: Day 21 GET /api/hours/my remains operational (200 OK)'
    );

    // Test 30: Day 21 GET /api/hours/organization remains operational
    const regOrgHoursRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      regOrgHoursRes.status === 200,
      'Test 30: Day 21 GET /api/hours/organization remains operational (200 OK)'
    );

    // Test 31: Day 22 PATCH /api/hours/:id/status remains operational
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
      'Test 31: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 32: Day 23 GET /api/hours/my/summary remains operational
    const regSummaryRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regSummaryRes.status === 200,
      'Test 32: Day 23 GET /api/hours/my/summary remains operational (200 OK)'
    );

    // Test 33: Day 24 & 25 GET /api/hours/organization/opportunities with date filter remains operational
    const regOppSummaryRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-01-01&to_date=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    assert(
      regOppSummaryRes.status === 200,
      'Test 33: Day 24 & 25 GET /api/hours/organization/opportunities with date filter remains operational (200 OK)'
    );

    // Test 34: Day 26 GET /api/hours/my?from_date=2026-01-01&to_date=2026-12-31 remains operational
    const regDateHoursRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2026-01-01&to_date=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      regDateHoursRes.status === 200,
      'Test 34: Day 26 GET /api/hours/my date-based retrieval remains operational (200 OK)'
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
  console.log(`  DAY 27 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
