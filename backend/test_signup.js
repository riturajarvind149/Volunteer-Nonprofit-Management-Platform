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
  console.log(`  DAY 17: VOLUNTEER SIGNUP MANAGEMENT FOUNDATION TEST SUITE   `);
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
    full_name: 'Signup Test Coordinator',
    email: `coord.signup.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Volunteer Alice',
    email: `vol1.signup.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Volunteer Bob',
    email: `vol2.signup.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer3 = {
    full_name: 'Volunteer Charlie',
    email: `vol3.signup.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator.email,
    volunteer1.email,
    volunteer2.email,
    volunteer3.email,
  ];

  const cleanupDatabase = async () => {
    // Delete signups, opportunities, organizations, users created for this test
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

  let tokenCoord;
  let tokenVol1;
  let tokenVol2;
  let tokenVol3;

  let vol1Id;
  let vol2Id;

  let publishedOppId;
  let draftOppId;
  let completedOppId;
  let cancelledOppId;
  let singleCapacityOppId;

  let aliceSignupId;

  try {
    // ----------------------------------------------------------------
    // Setup: Clean up and Register test users
    // ----------------------------------------------------------------
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

    await registerUser(coordinator);
    await registerUser(volunteer1);
    await registerUser(volunteer2);
    await registerUser(volunteer3);

    const coordLogin = await loginUser(coordinator.email, coordinator.password);
    tokenCoord = coordLogin.data.token;

    const vol1Login = await loginUser(volunteer1.email, volunteer1.password);
    tokenVol1 = vol1Login.data.token;
    vol1Id = vol1Login.data.user.id;

    const vol2Login = await loginUser(volunteer2.email, volunteer2.password);
    tokenVol2 = vol2Login.data.token;
    vol2Id = vol2Login.data.user.id;

    const vol3Login = await loginUser(volunteer3.email, volunteer3.password);
    tokenVol3 = vol3Login.data.token;

    // Create Organization by Coordinator
    const orgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`,
      },
      body: JSON.stringify({
        name: `Signup Foundation Org ${timestamp}`,
        description: 'Test NGO for signup verification',
        contact_email: coordinator.email,
        contact_phone: '+1 555-0199',
        address: '123 Foundation Lane',
      }),
    });
    const orgData = await orgRes.json();
    const orgId = orgData.data.organization.id;

    // Create Opportunities with different statuses & capacities
    const createOpp = async (title, status, capacity) => {
      const res = await fetch(`${baseUrl}/api/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCoord}`,
        },
        body: JSON.stringify({
          organization_id: orgId,
          title,
          description: `Description for ${title}`,
          category: 'Community',
          event_date: '2026-10-15',
          start_time: '09:00:00',
          end_time: '12:00:00',
          location: 'Community Park',
          address: '456 Park Ave',
          capacity,
          status,
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    publishedOppId = await createOpp('Beach Cleanup Drive', 'PUBLISHED', 10);
    draftOppId = await createOpp('Draft Workshop', 'DRAFT', 5);
    completedOppId = await createOpp('Completed Fundraiser', 'COMPLETED', 5);
    cancelledOppId = await createOpp('Cancelled Gala', 'CANCELLED', 5);
    singleCapacityOppId = await createOpp('Exclusive 1-Person Task', 'PUBLISHED', 1);

    console.log(`${colors.yellow}Test entities prepared successfully.${colors.reset}\n`);

    // ================================================================
    // Group 1: POST /api/opportunities/:opportunityId/signup Auth & RBAC
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization for Signup${colors.reset}`);

    // Test 1: Unauthenticated request returns 401
    const unauthRes = await fetch(`${baseUrl}/api/opportunities/${publishedOppId}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const unauthData = await unauthRes.json();
    assert(
      unauthRes.status === 401 && unauthData.status === 'error',
      'Test 1: Unauthenticated signup request rejected with 401 Unauthorized'
    );

    // Test 2: Coordinator role rejected with 403 (Volunteer only)
    const coordRes = await fetch(`${baseUrl}/api/opportunities/${publishedOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`,
      },
    });
    const coordData = await coordRes.json();
    assert(
      coordRes.status === 403 && coordData.status === 'error',
      'Test 2: Coordinator signup attempt rejected with 403 Forbidden (RBAC enforced)'
    );

    // ================================================================
    // Group 2: Parameter & Status Validations
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Opportunity ID & Status Validation${colors.reset}`);

    // Test 3: Invalid UUID format returns 400
    const invalidUuidRes = await fetch(`${baseUrl}/api/opportunities/invalid-uuid-format/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const invalidUuidData = await invalidUuidRes.json();
    assert(
      invalidUuidRes.status === 400 &&
        invalidUuidData.message.includes('valid UUID'),
      'Test 3: Invalid opportunityId format rejected with 400 Bad Request'
    );

    // Test 4: Non-existent opportunity UUID returns 404
    const nonExistentOppId = 'a0000000-0000-0000-0000-000000000000';
    const nonExistentRes = await fetch(`${baseUrl}/api/opportunities/${nonExistentOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const nonExistentData = await nonExistentRes.json();
    assert(
      nonExistentRes.status === 404 &&
        nonExistentData.message.includes('Opportunity not found'),
      'Test 4: Non-existent opportunityId returns 404 Not Found'
    );

    // Test 5: DRAFT opportunity cannot be signed up for (returns 400)
    const draftRes = await fetch(`${baseUrl}/api/opportunities/${draftOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const draftData = await draftRes.json();
    assert(
      draftRes.status === 400 &&
        draftData.message.includes('not published'),
      'Test 5: DRAFT opportunity signup rejected with 400 Bad Request'
    );

    // Test 6: COMPLETED opportunity cannot be signed up for (returns 400)
    const completedRes = await fetch(`${baseUrl}/api/opportunities/${completedOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const completedData = await completedRes.json();
    assert(
      completedRes.status === 400 &&
        completedData.message.includes('not published'),
      'Test 6: COMPLETED opportunity signup rejected with 400 Bad Request'
    );

    // Test 7: CANCELLED opportunity cannot be signed up for (returns 400)
    const cancelledRes = await fetch(`${baseUrl}/api/opportunities/${cancelledOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const cancelledData = await cancelledRes.json();
    assert(
      cancelledRes.status === 400 &&
        cancelledData.message.includes('not published'),
      'Test 7: CANCELLED opportunity signup rejected with 400 Bad Request'
    );

    // ================================================================
    // Group 3: Successful Signup Creation & Security
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Successful Signup Creation & Anti-Spoofing${colors.reset}`);

    // Test 8: Valid signup creates record with 201 Created
    const validSignupRes = await fetch(`${baseUrl}/api/opportunities/${publishedOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const validSignupData = await validSignupRes.json();
    assert(
      validSignupRes.status === 201 &&
        validSignupData.status === 'success' &&
        validSignupData.data?.signup?.id !== undefined,
      'Test 8: Valid signup created with status 201 Created'
    );
    aliceSignupId = validSignupData.data?.signup?.id;

    // Test 9: Returned signup record contains correct fields and status REGISTERED
    const signupObj = validSignupData.data?.signup;
    assert(
      signupObj.volunteer_id === vol1Id &&
        signupObj.opportunity_id === publishedOppId &&
        signupObj.status === 'REGISTERED' &&
        signupObj.created_at !== undefined,
      'Test 9: Signup payload has volunteer_id, opportunity_id, and default status REGISTERED'
    );

    // Test 10: Volunteer ID cannot be spoofed via body (binds strictly to req.user.id)
    const spoofAttemptRes = await fetch(`${baseUrl}/api/opportunities/${singleCapacityOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
      body: JSON.stringify({
        volunteer_id: 'b0000000-0000-0000-0000-000000000000', // Spoof attempt
      }),
    });
    const spoofAttemptData = await spoofAttemptRes.json();
    assert(
      spoofAttemptRes.status === 201 &&
        spoofAttemptData.data?.signup?.volunteer_id === vol1Id,
      'Test 10: Body volunteer_id stripped; signup bound strictly to authenticated req.user.id'
    );

    // ================================================================
    // Group 4: Duplicate & Capacity Conflict Enforcements
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Duplicate Prevention & Capacity Protection${colors.reset}`);

    // Test 11: Duplicate signup by the same volunteer rejected with 409 Conflict
    const dupRes = await fetch(`${baseUrl}/api/opportunities/${publishedOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const dupData = await dupRes.json();
    assert(
      dupRes.status === 409 &&
        dupData.message.includes('already signed up'),
      'Test 11: Duplicate signup rejected with 409 Conflict ("already signed up")'
    );

    // Test 12: Opportunity with capacity 1 rejects second volunteer with 409 Conflict
    const capacityRes = await fetch(`${baseUrl}/api/opportunities/${singleCapacityOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol2}`,
      },
    });
    const capacityData = await capacityRes.json();
    assert(
      capacityRes.status === 409 &&
        capacityData.message.includes('maximum capacity'),
      'Test 12: Signup for full opportunity rejected with 409 Conflict (capacity exceeded)'
    );

    // Test 13: Database constraint uq_signups_volunteer_opportunity verified
    const rawDupCatch = await (async () => {
      try {
        await pool.query(
          `INSERT INTO signups (volunteer_id, opportunity_id, status) VALUES ($1, $2, 'REGISTERED')`,
          [vol1Id, publishedOppId]
        );
        return false;
      } catch (err) {
        return err.code === '23505' && err.constraint === 'uq_signups_volunteer_opportunity';
      }
    })();
    assert(
      rawDupCatch,
      'Test 13: Database-level unique constraint uq_signups_volunteer_opportunity verified'
    );

    // ================================================================
    // Group 5: GET /api/signups/my
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Volunteer Signups Retrieval (GET /api/signups/my)${colors.reset}`);

    // Test 14: Unauthenticated GET /api/signups/my returns 401
    const unauthMyRes = await fetch(`${baseUrl}/api/signups/my`);
    assert(
      unauthMyRes.status === 401,
      'Test 14: Unauthenticated GET /api/signups/my returns 401 Unauthorized'
    );

    // Test 15: Coordinator cannot access /api/signups/my (Volunteer only, returns 403)
    const coordMyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenCoord}` },
    });
    assert(
      coordMyRes.status === 403,
      'Test 15: Coordinator GET /api/signups/my returns 403 Forbidden'
    );

    // Test 16: Volunteer with signups retrieves their list (200 OK)
    const vol1MyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const vol1MyData = await vol1MyRes.json();
    assert(
      vol1MyRes.status === 200 &&
        Array.isArray(vol1MyData.data?.signups) &&
        vol1MyData.data.signups.length === 2,
      'Test 16: Volunteer retrieves their signups array with status 200 OK'
    );

    // Test 17: Signups array contains joined opportunity metadata
    const firstItem = vol1MyData.data?.signups[0];
    assert(
      firstItem.opportunity_title !== undefined &&
        firstItem.opportunity_event_date !== undefined &&
        firstItem.opportunity_location !== undefined &&
        firstItem.opportunity_organization_id !== undefined,
      'Test 17: Signups include joined opportunity metadata (title, event_date, location, organization_id)'
    );

    // Test 18: Volunteer with no signups receives empty array []
    const vol3MyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol3}` },
    });
    const vol3MyData = await vol3MyRes.json();
    assert(
      vol3MyRes.status === 200 &&
        Array.isArray(vol3MyData.data?.signups) &&
        vol3MyData.data.signups.length === 0,
      'Test 18: Volunteer with no signups receives an empty array []'
    );

    // ================================================================
    // Group 6: GET /api/signups/:id Ownership & Isolation
    // ================================================================
    console.log(`\n${colors.bold}Group 6: Signup by ID & Ownership Isolation (GET /api/signups/:id)${colors.reset}`);

    // Test 19: Unauthenticated GET /api/signups/:id returns 401
    const unauthIdRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}`);
    assert(
      unauthIdRes.status === 401,
      'Test 19: Unauthenticated GET /api/signups/:id returns 401 Unauthorized'
    );

    // Test 20: Invalid UUID format returns 400
    const invalidIdRes = await fetch(`${baseUrl}/api/signups/not-a-uuid`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const invalidIdData = await invalidIdRes.json();
    assert(
      invalidIdRes.status === 400 &&
        invalidIdData.message.includes('valid UUID'),
      'Test 20: Invalid signup UUID returns 400 Bad Request'
    );

    // Test 21: Non-existent signup UUID returns 404
    const nonExistentSignupId = 'c0000000-0000-0000-0000-000000000000';
    const nonExistentSignupRes = await fetch(`${baseUrl}/api/signups/${nonExistentSignupId}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      nonExistentSignupRes.status === 404,
      'Test 21: Non-existent signup UUID returns 404 Not Found'
    );

    // Test 22: Volunteer 2 cannot access Volunteer 1's signup (returns 404 Not Found, preventing ID enumeration)
    const crossVolRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}`, {
      headers: { Authorization: `Bearer ${tokenVol2}` },
    });
    assert(
      crossVolRes.status === 404,
      'Test 22: Access to another volunteer signup returns 404 Not Found (Data Isolation)'
    );

    // Test 23: Volunteer 1 can retrieve their own signup by ID (200 OK)
    const ownSignupRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const ownSignupData = await ownSignupRes.json();
    assert(
      ownSignupRes.status === 200 &&
        ownSignupData.data?.signup?.id === aliceSignupId &&
        ownSignupData.data?.signup?.opportunity_title === 'Beach Cleanup Drive',
      'Test 23: Volunteer retrieves own signup with joined opportunity details (200 OK)'
    );

    // ================================================================
    // Group 7: Concurrency & Transaction Integrity
    // ================================================================
    console.log(`\n${colors.bold}Group 7: Concurrency & Transaction Integrity${colors.reset}`);

    // Create an opportunity with capacity = 1
    const raceOppId = await createOpp('High Demand Slot', 'PUBLISHED', 1);

    // Create two fresh volunteers
    const racer1 = {
      full_name: 'Racer One',
      email: `racer1.${timestamp}@test.org`,
      password: 'Password123!',
      role: 'VOLUNTEER',
    };
    const racer2 = {
      full_name: 'Racer Two',
      email: `racer2.${timestamp}@test.org`,
      password: 'Password123!',
      role: 'VOLUNTEER',
    };
    await registerUser(racer1);
    await registerUser(racer2);
    testEmails.push(racer1.email, racer2.email);

    const racer1Login = await loginUser(racer1.email, racer1.password);
    const racer2Login = await loginUser(racer2.email, racer2.password);

    // Fire simultaneous signups
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/opportunities/${raceOppId}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${racer1Login.data.token}`,
        },
      }),
      fetch(`${baseUrl}/api/opportunities/${raceOppId}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${racer2Login.data.token}`,
        },
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      'Test 24: Concurrent requests on capacity=1: exactly one succeeds (201) and one is rejected (409)'
    );

    // Verify row count in database
    const finalCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM signups WHERE opportunity_id = $1`,
      [raceOppId]
    );
    assert(
      finalCountRes.rows[0].count === 1,
      'Test 25: Database integrity verified: exactly 1 signup stored for raceOppId'
    );

    // ================================================================
    // Group 8: Volunteer Signup Cancellation (PATCH /api/signups/:id/cancel)
    // ================================================================
    console.log(`\n${colors.bold}Group 8: Volunteer Signup Cancellation / Withdrawal${colors.reset}`);

    // Test 26: Missing JWT returns 401 Unauthorized
    const unauthCancelRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });
    assert(
      unauthCancelRes.status === 401,
      'Test 26: Missing JWT on cancel request returns 401 Unauthorized'
    );

    // Test 27: Coordinator role rejected with 403 Forbidden
    const coordCancelRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`,
      },
    });
    assert(
      coordCancelRes.status === 403,
      'Test 27: Coordinator cancellation attempt rejected with 403 Forbidden (RBAC enforced)'
    );

    // Test 28: Invalid signup UUID returns 400 Bad Request
    const invalidCancelIdRes = await fetch(`${baseUrl}/api/signups/not-a-valid-uuid/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const invalidCancelIdData = await invalidCancelIdRes.json();
    assert(
      invalidCancelIdRes.status === 400 &&
        invalidCancelIdData.message.includes('valid UUID'),
      'Test 28: Invalid signup UUID on cancel returns 400 Bad Request'
    );

    // Test 29: Non-existent signup UUID returns 404 Not Found
    const nonExistentCancelRes = await fetch(`${baseUrl}/api/signups/${nonExistentSignupId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    assert(
      nonExistentCancelRes.status === 404,
      'Test 29: Non-existent signup UUID on cancel returns 404 Not Found'
    );

    // Test 30: Volunteer attempts to cancel another volunteer's signup returns 404 (Ownership Isolation)
    const crossCancelRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol2}`,
      },
    });
    assert(
      crossCancelRes.status === 404,
      'Test 30: Volunteer attempting to cancel another volunteer signup returns 404 Not Found'
    );

    // Test 31: Volunteer successfully cancels own signup (200 OK)
    const validCancelRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
      body: JSON.stringify({
        volunteer_id: vol2Id, // Attempt to spoof volunteer_id (must be ignored)
      }),
    });
    const validCancelData = await validCancelRes.json();
    assert(
      validCancelRes.status === 200 &&
        validCancelData.status === 'success' &&
        validCancelData.message.includes('cancelled successfully'),
      'Test 31: Volunteer successfully cancels own signup (200 OK)'
    );

    // Test 32: Returned signup status is CANCELLED
    assert(
      validCancelData.data?.signup?.status === 'CANCELLED',
      'Test 32: Returned signup record status is CANCELLED'
    );

    // Test 33: Database confirms status is CANCELLED and updated_at modified
    const dbCheckRes = await pool.query(
      `SELECT status, updated_at, created_at FROM signups WHERE id = $1`,
      [aliceSignupId]
    );
    assert(
      dbCheckRes.rows.length === 1 &&
        dbCheckRes.rows[0].status === 'CANCELLED' &&
        new Date(dbCheckRes.rows[0].updated_at) >= new Date(dbCheckRes.rows[0].created_at),
      'Test 33: Database row confirms status is CANCELLED and updated_at reflects timestamp'
    );

    // Test 34: Already cancelled signup cannot be cancelled again (returns 400 Bad Request)
    const repeatCancelRes = await fetch(`${baseUrl}/api/signups/${aliceSignupId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const repeatCancelData = await repeatCancelRes.json();
    assert(
      repeatCancelRes.status === 400 &&
        repeatCancelData.message.includes('already cancelled'),
      'Test 34: Already cancelled signup cannot be cancelled again (400 Bad Request)'
    );

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  } finally {
    // Teardown
    await cleanupDatabase();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log(`\n=============================================================`);
  console.log(`  DAY 17 & 18 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
