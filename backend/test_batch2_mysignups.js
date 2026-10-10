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
  console.log(`  BATCH 2: MY SIGNUPS & CANCELLATION EXPERIENCE TEST SUITE   `);
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
  const coordinator = {
    full_name: 'Coordinator Batch2',
    email: `coord.batch2.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteerAlice = {
    full_name: 'Alice Volunteer Batch2',
    email: `alice.batch2.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteerBob = {
    full_name: 'Bob Volunteer Batch2',
    email: `bob.batch2.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator.email,
    volunteerAlice.email,
    volunteerBob.email,
  ];

  const cleanupDatabase = async () => {
    try {
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
      await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [testEmails]);
    } catch (err) {
      console.error('Error during DB cleanup:', err.message);
    }
  };

  const registerUser = async (userObj) => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userObj),
    });
    return res.json();
  };

  const loginUser = async (email, password) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  };

  try {
    // Initial cleanup
    await cleanupDatabase();

    // Register test accounts
    await registerUser(coordinator);
    await registerUser(volunteerAlice);
    await registerUser(volunteerBob);

    // Login test accounts
    const coordLogin = await loginUser(coordinator.email, coordinator.password);
    const aliceLogin = await loginUser(volunteerAlice.email, volunteerAlice.password);
    const bobLogin = await loginUser(volunteerBob.email, volunteerBob.password);

    const tokenCoord = coordLogin.data?.token;
    const tokenAlice = aliceLogin.data?.token;
    const tokenBob = bobLogin.data?.token;

    // Helper to create an organization
    const createOrg = async (token, name) => {
      const res = await fetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description: 'Test Org for Batch 2' }),
      });
      const data = await res.json();
      return data.data?.organization?.id;
    };

    // Helper to create an opportunity
    const createOpp = async (token, orgId, title, options = {}) => {
      const payload = {
        organization_id: orgId,
        title,
        description: 'Test Opportunity Description',
        category: 'Community Support',
        event_date: options.event_date || '2027-04-10',
        start_time: '09:00:00',
        end_time: '13:00:00',
        location: 'Downtown Center',
        capacity: options.capacity || 10,
        status: options.status || 'PUBLISHED',
      };
      const res = await fetch(`${baseUrl}/api/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data.data?.opportunity?.id;
    };

    // Setup base organization & opportunities
    const orgId = await createOrg(tokenCoord, 'Helping Hands Network');
    const opp1Id = await createOpp(tokenCoord, orgId, 'Community Food Drive');
    const opp2Id = await createOpp(tokenCoord, orgId, 'Neighborhood Literacy Mentoring');

    // =========================================================================
    // SECTION 1: AUTHENTICATION & ROLE ACCESS
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 1: Authentication & Role Protections ---${colors.reset}`);

    // Test 1: Unauthenticated access to /api/signups/my returns 401
    const unauthMyRes = await fetch(`${baseUrl}/api/signups/my`);
    assert(
      unauthMyRes.status === 401,
      'Test 1: Unauthenticated request to /api/signups/my returns 401 Unauthorized'
    );

    // Test 2: Unauthenticated cancellation returns 401
    const unauthCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'DELETE',
    });
    assert(
      unauthCancelRes.status === 401,
      'Test 2: Unauthenticated cancellation request returns 401 Unauthorized'
    );

    // Test 3: Coordinator cannot access /api/signups/my (403 Forbidden)
    const coordMyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenCoord}` },
    });
    assert(
      coordMyRes.status === 403,
      'Test 3: Coordinator access to /api/signups/my rejected with 403 Forbidden'
    );

    // Test 4: Coordinator cannot cancel volunteer signup (403 Forbidden)
    const coordCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCoord}` },
    });
    assert(
      coordCancelRes.status === 403,
      'Test 4: Coordinator cancellation request rejected with 403 Forbidden'
    );

    // =========================================================================
    // SECTION 2: EMPTY SIGNUP LIST STATE
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 2: Empty Signups State ---${colors.reset}`);

    // Test 5: Volunteer Alice with no signups receives empty list []
    const emptyAliceRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const emptyAliceData = await emptyAliceRes.json();
    assert(
      emptyAliceRes.status === 200 &&
        Array.isArray(emptyAliceData.data?.signups) &&
        emptyAliceData.data.signups.length === 0,
      'Test 5: Volunteer with no signups receives empty array [] with status 200 OK'
    );

    // =========================================================================
    // SECTION 3: SIGNUP REGISTRATION & POPULATED RETRIEVAL
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 3: Signups Retrieval & Data Integrity ---${colors.reset}`);

    // Alice signs up for opp1Id and opp2Id
    const aliceSign1Res = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceSign1Data = await aliceSign1Res.json();
    const aliceSignup1Id = aliceSign1Data.data?.signup?.id;

    const aliceSign2Res = await fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceSign2Data = await aliceSign2Res.json();
    const aliceSignup2Id = aliceSign2Data.data?.signup?.id;

    assert(
      aliceSign1Res.status === 201 && aliceSign2Res.status === 201,
      'Test 6: Volunteer Alice successfully registers for 2 opportunities (201 Created)'
    );

    // Test 7: Alice retrieves both signups
    const aliceMyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceMyData = await aliceMyRes.json();
    const aliceSignups = aliceMyData.data?.signups || [];
    assert(
      aliceMyRes.status === 200 && aliceSignups.length === 2,
      'Test 7: Alice retrieves exactly 2 signups from /api/signups/my'
    );

    // Test 8: Response includes joined opportunity and organization metadata
    const firstSignup = aliceSignups[0];
    assert(
      firstSignup &&
        firstSignup.id !== undefined &&
        firstSignup.opportunity_id !== undefined &&
        firstSignup.status === 'REGISTERED' &&
        firstSignup.opportunity_title !== undefined &&
        firstSignup.opportunity_event_date !== undefined &&
        firstSignup.organization_name === 'Helping Hands Network',
      'Test 8: Signup record includes signup ID, opportunity ID, status, title, date, and organization_name'
    );

    // Test 9: Data Isolation - Bob cannot see Alice's signups
    const bobMyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const bobMyData = await bobMyRes.json();
    assert(
      bobMyRes.status === 200 &&
        Array.isArray(bobMyData.data?.signups) &&
        bobMyData.data.signups.length === 0,
      'Test 9: Volunteer Bob cannot see Alice signups (Data isolation enforced)'
    );

    // =========================================================================
    // SECTION 4: SIGNUP CANCELLATION WORKFLOW
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 4: Signup Cancellation Workflow ---${colors.reset}`);

    // Test 10: Bob cannot cancel Alice's signup via DELETE /opportunities/:opp1Id/signup (404)
    const bobCrossCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert(
      bobCrossCancelRes.status === 404,
      'Test 10: Cross-volunteer cancellation returns 404 Not Found'
    );

    // Test 11: Alice cancels her signup for opp1Id
    const aliceCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceCancelData = await aliceCancelRes.json();
    assert(
      aliceCancelRes.status === 200 &&
        aliceCancelData.status === 'success' &&
        aliceCancelData.data?.signup?.status === 'CANCELLED',
      'Test 11: Alice successfully cancels signup via DELETE /opportunities/:oppId/signup (200 OK)'
    );

    // Test 12: After cancellation, /api/signups/my reflects status CANCELLED
    const aliceMyAfterCancelRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceMyAfterCancelData = await aliceMyAfterCancelRes.json();
    const updatedSignups = aliceMyAfterCancelData.data?.signups || [];
    const opp1Signup = updatedSignups.find((s) => s.opportunity_id === opp1Id);
    const opp2Signup = updatedSignups.find((s) => s.opportunity_id === opp2Id);

    assert(
      opp1Signup && opp1Signup.status === 'CANCELLED' &&
        opp2Signup && opp2Signup.status === 'REGISTERED',
      'Test 12: /api/signups/my correctly displays opp1 as CANCELLED and opp2 as REGISTERED'
    );

    // Test 13: Repeated cancellation of already-cancelled signup returns 400 Bad Request
    const repeatCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert(
      repeatCancelRes.status === 400,
      'Test 13: Repeated cancellation of already-cancelled signup returns 400 Bad Request'
    );

    // Test 14: Invalid opportunity ID on cancellation returns 400
    const invalidIdRes = await fetch(`${baseUrl}/api/opportunities/invalid-uuid-string/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert(
      invalidIdRes.status === 400,
      'Test 14: Invalid opportunity UUID format on cancellation returns 400 Bad Request'
    );

    // Test 15: Non-existent opportunity UUID on cancellation returns 404
    const nonExistentOppId = 'a0000000-0000-0000-0000-000000000000';
    const nonExistentCancelRes = await fetch(`${baseUrl}/api/opportunities/${nonExistentOppId}/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert(
      nonExistentCancelRes.status === 404,
      'Test 15: Non-existent opportunity UUID returns 404 Not Found'
    );

    // Test 16: Concurrency Safety - multiple simultaneous cancellation requests
    // Bob signs up for opp2Id, then fires two simultaneous cancel requests
    await fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });

    const [cancelResA, cancelResB] = await Promise.all([
      fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenBob}` },
      }),
      fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenBob}` },
      }),
    ]);

    const statuses = [cancelResA.status, cancelResB.status].sort();
    assert(
      statuses[0] === 200 && statuses[1] === 400,
      'Test 16: Concurrent cancellation requests safely resolved (one 200 OK, one 400 Bad Request)'
    );

  } catch (error) {
    console.error(`\n${colors.red}Unhandled Exception in test suite:${colors.reset}`, error);
    failed++;
  } finally {
    // Cleanup database
    await cleanupDatabase();

    // Close server and DB pool
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();

    console.log(`\n${colors.bold}-------------------------------------------------------------`);
    console.log(`  BATCH 2 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`-------------------------------------------------------------${colors.reset}\n`);

    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
