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
  console.log(`  BATCH 4: COORDINATOR ATTENDEE & SIGNUP MANAGEMENT SUITE    `);
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
  const coordA = {
    full_name: 'Coordinator Alpha Batch4',
    email: `coord.alpha.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordB = {
    full_name: 'Coordinator Beta Batch4',
    email: `coord.beta.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteerAlice = {
    full_name: 'Alice Volunteer Batch4',
    email: `alice.batch4.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteerBob = {
    full_name: 'Bob Volunteer Batch4',
    email: `bob.batch4.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteerCharlie = {
    full_name: 'Charlie Volunteer Batch4',
    email: `charlie.batch4.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordA.email,
    coordB.email,
    volunteerAlice.email,
    volunteerBob.email,
    volunteerCharlie.email,
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

    // Register all test users
    await registerUser(coordA);
    await registerUser(coordB);
    await registerUser(volunteerAlice);
    await registerUser(volunteerBob);
    await registerUser(volunteerCharlie);

    // Login users and obtain JWTs
    const loginCoordA = await loginUser(coordA.email, coordA.password);
    const loginCoordB = await loginUser(coordB.email, coordB.password);
    const loginAlice = await loginUser(volunteerAlice.email, volunteerAlice.password);
    const loginBob = await loginUser(volunteerBob.email, volunteerBob.password);
    const loginCharlie = await loginUser(volunteerCharlie.email, volunteerCharlie.password);

    const tokenCoordA = loginCoordA.data?.token;
    const tokenCoordB = loginCoordB.data?.token;
    const tokenAlice = loginAlice.data?.token;
    const tokenBob = loginBob.data?.token;
    const tokenCharlie = loginCharlie.data?.token;

    assert(tokenCoordA && tokenCoordB && tokenAlice && tokenBob, 'All test actors authenticated successfully');

    // Create Organizations
    const createOrg = async (token, name) => {
      const res = await fetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description: 'Test Org for Batch 4' }),
      });
      const data = await res.json();
      return data.data?.organization?.id;
    };

    const orgIdA = await createOrg(tokenCoordA, 'Coord A Community Org');
    const orgIdB = await createOrg(tokenCoordB, 'Coord B Regional Org');
    assert(orgIdA && orgIdB, 'Organizations created for Coordinator A and Coordinator B');

    // Create Opportunities
    // Opp 1: Coord A, Capacity = 5, Published
    const createOpp = async (token, orgId, title, capacity = 5) => {
      const res = await fetch(`${baseUrl}/api/opportunities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organization_id: orgId,
          title,
          description: 'Batch 4 Test Event Description',
          category: 'Community',
          event_date: '2027-06-15',
          start_time: '10:00:00',
          end_time: '14:00:00',
          location: 'Community Center Main Hall',
          capacity,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data?.opportunity?.id;
    };

    const opp1Id = await createOpp(tokenCoordA, orgIdA, 'Tree Planting Gala', 5);
    // Opp 2: Coord A, Capacity = 1, Published (for capacity constraint testing)
    const opp2Id = await createOpp(tokenCoordA, orgIdA, 'Solo Rescue Lead', 1);
    // Opp 3: Coord B, Capacity = 5, Published
    const opp3Id = await createOpp(tokenCoordB, orgIdB, 'Coastal Clean-up', 5);

    assert(opp1Id && opp2Id && opp3Id, 'Created test opportunities for both coordinators');

    // Signups for Opp 1: Alice and Bob
    const signupVolunteer = async (token, oppId) => {
      const res = await fetch(`${baseUrl}/api/opportunities/${oppId}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      return { status: res.status, body: await res.json() };
    };

    const signupAliceOpp1 = await signupVolunteer(tokenAlice, opp1Id);
    const signupBobOpp1 = await signupVolunteer(tokenBob, opp1Id);
    const signupAliceId = signupAliceOpp1.body.data?.signup?.id;
    const signupBobId = signupBobOpp1.body.data?.signup?.id;

    assert(
      signupAliceOpp1.status === 201 && signupAliceId,
      'Volunteer Alice successfully signed up for Opportunity 1'
    );
    assert(
      signupBobOpp1.status === 201 && signupBobId,
      'Volunteer Bob successfully signed up for Opportunity 1'
    );

    console.log(`\n${colors.cyan}--- 1. ATTENDEE ROSTER RETRIEVAL & SHAPE ---${colors.reset}`);

    // Test 1: Coordinator can retrieve attendees for owned opportunity
    const rosterRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signups`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const rosterData = await rosterRes.json();

    assert(rosterRes.status === 200, 'GET /api/opportunities/:id/signups returns 200 for owner coordinator');
    assert(rosterData.status === 'success', 'Roster response status is success');
    assert(
      rosterData.data?.opportunity?.id === opp1Id,
      'Roster payload contains opportunity object with matching ID'
    );
    const attendees = rosterData.data?.signups || rosterData.data?.attendees;
    assert(Array.isArray(attendees) && attendees.length === 2, 'Roster contains 2 registered attendees');

    const aliceEntry = attendees.find((a) => a.volunteer_email === volunteerAlice.email);
    assert(
      aliceEntry && (aliceEntry.volunteer_name === volunteerAlice.full_name || aliceEntry.volunteer_full_name === volunteerAlice.full_name),
      'Attendee entry includes volunteer name matching profile'
    );
    assert(
      aliceEntry && (aliceEntry.status === 'REGISTERED' || aliceEntry.signup_status === 'REGISTERED'),
      'Attendee entry has status REGISTERED'
    );
    assert(
      aliceEntry && (aliceEntry.created_at || aliceEntry.signup_created_at),
      'Attendee entry contains registration date/time'
    );
    assert(
      !aliceEntry.password && !aliceEntry.password_hash,
      'Security: Attendee entry strictly excludes sensitive fields (no password hash)'
    );

    console.log(`\n${colors.cyan}--- 2. OWNERSHIP & SECURITY ENFORCEMENT ---${colors.reset}`);

    // Test 2: Coordinator B cannot access Coordinator A's attendee roster
    const crossCoordRosterRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signups`, {
      headers: { Authorization: `Bearer ${tokenCoordB}` },
    });
    assert(
      crossCoordRosterRes.status === 403,
      'Coordinator B receives 403 Forbidden when requesting Coordinator A attendee roster'
    );

    // Test 3: Volunteers cannot access coordinator attendee roster endpoint
    const volunteerRosterRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signups`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert(
      volunteerRosterRes.status === 403,
      'Volunteer receives 403 Forbidden when accessing coordinator attendee roster'
    );

    // Test 4: Unauthenticated request is rejected
    const unauthRosterRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signups`);
    assert(
      unauthRosterRes.status === 401,
      'Unauthenticated request to attendee roster returns 401 Unauthorized'
    );

    // Test 5: Non-existent opportunity returns 404
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const notFoundRosterRes = await fetch(`${baseUrl}/api/opportunities/${fakeUuid}/signups`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    assert(
      notFoundRosterRes.status === 404,
      'Coordinator querying non-existent opportunity receives 404 Not Found'
    );

    console.log(`\n${colors.cyan}--- 3. SIGNUP DETAILS ENDPOINT CONTRACT & OWNERSHIP ---${colors.reset}`);

    // Test 6: Coordinator A retrieves detail for signup in owned opportunity
    const detailRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200, 'Coordinator A can retrieve signup detail for owned opportunity (200)');
    assert(
      detailData.data?.signup?.id === signupAliceId,
      'Signup detail returns correct signup ID'
    );
    assert(
      detailData.data?.signup?.opportunity_id === opp1Id,
      'Signup detail clearly distinguishes signup ID from opportunity ID'
    );
    assert(
      detailData.data?.signup?.volunteer_email === volunteerAlice.email,
      'Signup detail displays volunteer email'
    );
    assert(
      !detailData.data?.signup?.password && !detailData.data?.signup?.password_hash,
      'Security: Signup detail strictly avoids password hashes or secrets'
    );

    // Test 7: Coordinator B cannot view signup detail for Coordinator A's opportunity
    const crossCoordDetailRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}`, {
      headers: { Authorization: `Bearer ${tokenCoordB}` },
    });
    assert(
      crossCoordDetailRes.status === 403,
      'Coordinator B receives 403 Forbidden when requesting another coordinator signup detail'
    );

    // Test 8: Volunteer Alice can view her own signup detail
    const ownVolunteerDetailRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert(
      ownVolunteerDetailRes.status === 200,
      'Volunteer Alice can access her own signup detail (200)'
    );

    // Test 9: Volunteer Bob cannot view Alice's signup detail (returns 404 anti-enumeration)
    const otherVolunteerDetailRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert(
      otherVolunteerDetailRes.status === 404,
      'Volunteer Bob receives 404 Not Found when attempting to access Alice signup detail'
    );

    // Test 10: Non-existent signup detail returns 404
    const notFoundDetailRes = await fetch(`${baseUrl}/api/signups/${fakeUuid}`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    assert(
      notFoundDetailRes.status === 404,
      'Querying non-existent signup ID returns 404 Not Found'
    );

    console.log(`\n${colors.cyan}--- 4. COORDINATOR STATUS MANAGEMENT ---${colors.reset}`);

    // Test 11: Volunteer cannot update signup status
    const volUpdateStatusRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      volUpdateStatusRes.status === 403,
      'Volunteer receives 403 Forbidden when attempting PATCH /api/signups/:id/status'
    );

    // Test 12: Coordinator B cannot update Coordinator A's signup status
    const crossCoordUpdateRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordB}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      crossCoordUpdateRes.status === 403,
      'Coordinator B receives 403 Forbidden when attempting to modify Coordinator A signup'
    );

    // Test 13: Invalid status string rejected with 400
    const invalidStatusRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'ATTENDED' }),
    });
    assert(
      invalidStatusRes.status === 400,
      'Attempting to update status to unpermitted value (ATTENDED) returns 400 Bad Request'
    );

    // Test 14: Another invalid status (COMPLETED) rejected with 400
    const completedStatusRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(
      completedStatusRes.status === 400,
      'Attempting to update status to COMPLETED returns 400 Bad Request'
    );

    // Test 15: Missing status field rejected with 400
    const missingStatusRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({}),
    });
    assert(
      missingStatusRes.status === 400,
      'PATCH /api/signups/:id/status without status body returns 400 Bad Request'
    );

    // Test 16: Coordinator A cancels Alice's signup (valid status transition)
    const cancelRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, 'Coordinator A successfully cancels signup (200 OK)');
    assert(
      cancelData.data?.signup?.status === 'CANCELLED',
      'Returned signup record confirms status is now CANCELLED'
    );

    // Test 17: Roster now reflects CANCELLED status for Alice and REGISTERED for Bob
    const rosterAfterCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signups`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const rosterAfterCancelData = await rosterAfterCancelRes.json();
    const updatedAttendees = rosterAfterCancelData.data?.signups || rosterAfterCancelData.data?.attendees;
    const aliceInRoster = updatedAttendees.find((a) => a.volunteer_email === volunteerAlice.email);
    const bobInRoster = updatedAttendees.find((a) => a.volunteer_email === volunteerBob.email);

    assert(
      (aliceInRoster.status || aliceInRoster.signup_status) === 'CANCELLED',
      'Attendee roster reflects CANCELLED status for Alice'
    );
    assert(
      (bobInRoster.status || bobInRoster.signup_status) === 'REGISTERED',
      'Attendee roster reflects REGISTERED status for Bob'
    );

    // Test 18: Coordinator A reactivates Alice's signup back to REGISTERED
    const reactivateRes = await fetch(`${baseUrl}/api/signups/${signupAliceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });
    const reactivateData = await reactivateRes.json();
    assert(reactivateRes.status === 200, 'Coordinator A successfully reactivates signup (200 OK)');
    assert(
      reactivateData.data?.signup?.status === 'REGISTERED',
      'Returned signup record confirms status is now REGISTERED again'
    );

    console.log(`\n${colors.cyan}--- 5. CAPACITY CONSTRAINTS ON REACTIVATION ---${colors.reset}`);

    // Opp 2 has capacity = 1
    // Step A: Alice signs up for Opp 2 -> 1/1 capacity full
    const aliceOpp2Signup = await signupVolunteer(tokenAlice, opp2Id);
    const aliceOpp2SignupId = aliceOpp2Signup.body.data?.signup?.id;
    assert(aliceOpp2Signup.status === 201 && aliceOpp2SignupId, 'Alice signed up for capacity=1 Opportunity 2 (1/1)');

    // Step B: Coordinator A cancels Alice's signup -> active signups = 0/1
    const cancelAliceOpp2 = await fetch(`${baseUrl}/api/signups/${aliceOpp2SignupId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(cancelAliceOpp2.status === 200, 'Coordinator cancelled Alice on Opportunity 2 (0/1 active)');

    // Step C: Bob signs up for Opp 2 -> active signups = 1/1 (capacity full again)
    const bobOpp2Signup = await signupVolunteer(tokenBob, opp2Id);
    assert(bobOpp2Signup.status === 201, 'Bob signed up for Opportunity 2 (1/1 full)');

    // Step D: Coordinator tries to reactivate Alice's cancelled signup when capacity is full
    const reactivateExceedRes = await fetch(`${baseUrl}/api/signups/${aliceOpp2SignupId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });
    const reactivateExceedData = await reactivateExceedRes.json();
    assert(
      reactivateExceedRes.status === 409,
      'Reactivation when capacity is full returns 409 Conflict'
    );
    assert(
      reactivateExceedData.message && reactivateExceedData.message.toLowerCase().includes('capacity'),
      '409 error message clearly indicates capacity constraint'
    );

    // Step E: Verify Alice status remains CANCELLED after rejected reactivation
    const detailAfterFailedReactivation = await fetch(`${baseUrl}/api/signups/${aliceOpp2SignupId}`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const detailAfterFailedData = await detailAfterFailedReactivation.json();
    assert(
      detailAfterFailedData.data?.signup?.status === 'CANCELLED',
      'Signup status remains CANCELLED after rejected capacity-exceeded reactivation'
    );

    console.log(`\n${colors.cyan}--- 6. ROSTER WITH MIXED STATUSES DISPLAY ---${colors.reset}`);

    // Query Opp 2 signups: Bob is REGISTERED, Alice is CANCELLED
    const opp2RosterRes = await fetch(`${baseUrl}/api/opportunities/${opp2Id}/signups`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const opp2RosterData = await opp2RosterRes.json();
    const opp2Attendees = opp2RosterData.data?.signups || opp2RosterData.data?.attendees;

    assert(
      opp2Attendees.length === 2,
      'Opp 2 roster includes both registered and cancelled attendees for complete coordinator auditing'
    );
    const registeredCount = opp2Attendees.filter(
      (a) => (a.status || a.signup_status) === 'REGISTERED'
    ).length;
    const cancelledCount = opp2Attendees.filter(
      (a) => (a.status || a.signup_status) === 'CANCELLED'
    ).length;
    assert(registeredCount === 1, 'Exactly 1 attendee with status REGISTERED in Opp 2');
    assert(cancelledCount === 1, 'Exactly 1 attendee with status CANCELLED in Opp 2');

  } catch (err) {
    console.error(`\n${colors.red}Unexpected error in test execution:${colors.reset}`, err);
    failed++;
  } finally {
    await cleanupDatabase();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  }

  console.log(`\n${colors.bold}${colors.cyan}=============================================================`);
  console.log(`  BATCH 4 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
