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
  console.log(`  BATCH 1: CRITICAL INTEGRATION FIXES TEST SUITE             `);
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
    full_name: 'Coordinator Batch1 One',
    email: `coord1.batch1.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Coordinator Batch1 Two',
    email: `coord2.batch1.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Volunteer Alice Batch1',
    email: `vol1.batch1.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Volunteer Bob Batch1',
    email: `vol2.batch1.${timestamp}@test.org`,
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
    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(volunteer1);
    await registerUser(volunteer2);

    // Login test accounts
    const coord1Login = await loginUser(coordinator1.email, coordinator1.password);
    const coord2Login = await loginUser(coordinator2.email, coordinator2.password);
    const vol1Login = await loginUser(volunteer1.email, volunteer1.password);
    const vol2Login = await loginUser(volunteer2.email, volunteer2.password);

    const tokenCoord1 = coord1Login.data?.token;
    const tokenCoord2 = coord2Login.data?.token;
    const tokenVol1 = vol1Login.data?.token;
    const tokenVol2 = vol2Login.data?.token;

    // Helper to create an organization
    const createOrg = async (token, name) => {
      const res = await fetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description: 'Test Org' }),
      });
      const data = await res.json();
      return data.data?.organization?.id;
    };

    // Helper to create an opportunity
    const createOpp = async (token, orgId, title, options = {}) => {
      const payload = {
        organization_id: orgId,
        title,
        description: 'Test Opportunity',
        category: 'Community',
        event_date: options.event_date || '2027-01-15',
        start_time: '10:00:00',
        end_time: '12:00:00',
        location: 'Community Park',
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

    // Helper to sign up volunteer
    const signUpVolunteer = async (token, oppId) => {
      const res = await fetch(`${baseUrl}/api/opportunities/${oppId}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      return res.json();
    };

    // Setup base data
    const org1Id = await createOrg(tokenCoord1, 'Green Earth Initiative');
    const oppUpcomingId = await createOpp(tokenCoord1, org1Id, 'Future Park Clean', {
      event_date: '2028-05-20',
      status: 'PUBLISHED',
    });
    const oppCompletedId = await createOpp(tokenCoord1, org1Id, 'Past River Clean', {
      event_date: '2024-01-10',
      status: 'COMPLETED',
    });
    const oppDraftId = await createOpp(tokenCoord1, org1Id, 'Draft Winter Food Drive', {
      event_date: '2028-12-01',
      status: 'DRAFT',
    });

    // =========================================================================
    // TASK 1: FIX SIGNUP CANCELLATION (DELETE /api/opportunities/:id/signup)
    // =========================================================================
    console.log(`\n${colors.bold}--- TASK 1: Signup Cancellation Integration ---${colors.reset}`);

    // Test 1: Unauthenticated DELETE /api/opportunities/:oppId/signup returns 401
    const unauthCancelRes = await fetch(
      `${baseUrl}/api/opportunities/${oppUpcomingId}/signup`,
      { method: 'DELETE' }
    );
    assert(
      unauthCancelRes.status === 401,
      'Test 1: Unauthenticated DELETE /api/opportunities/:id/signup returns 401'
    );

    // Test 2: Wrong-role request (Coordinator) returns 403 Forbidden
    const coordCancelRes = await fetch(
      `${baseUrl}/api/opportunities/${oppUpcomingId}/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    assert(
      coordCancelRes.status === 403,
      'Test 2: Coordinator request to cancel signup returns 403 Forbidden'
    );

    // Test 3: Invalid UUID format returns 400 Bad Request
    const invalidIdRes = await fetch(
      `${baseUrl}/api/opportunities/not-a-uuid/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      invalidIdRes.status === 400,
      'Test 3: Invalid opportunity UUID format on cancel returns 400 Bad Request'
    );

    // Test 4: Signup not found (volunteer has not signed up) returns 404
    const notFoundCancelRes = await fetch(
      `${baseUrl}/api/opportunities/${oppUpcomingId}/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      notFoundCancelRes.status === 404,
      'Test 4: Cancellation when volunteer has not signed up returns 404 Not Found'
    );

    // Volunteer 1 signs up for oppUpcomingId
    const signup1Res = await signUpVolunteer(tokenVol1, oppUpcomingId);
    const signup1Id = signup1Res.data?.signup?.id;
    assert(
      signup1Res.status === 'success' && !!signup1Id,
      'Setup: Volunteer 1 successfully registered for upcoming opportunity'
    );

    // Test 5: Volunteer 2 cannot cancel Volunteer 1's signup (returns 404 - data isolation)
    const vol2CancelVol1Res = await fetch(
      `${baseUrl}/api/opportunities/${oppUpcomingId}/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenVol2}` },
      }
    );
    assert(
      vol2CancelVol1Res.status === 404,
      'Test 5: Volunteer 2 attempting to cancel Volunteer 1 signup returns 404 (Data Isolation)'
    );

    // Test 6: Successful cancellation via DELETE /api/opportunities/:opportunityId/signup
    const vol1CancelRes = await fetch(
      `${baseUrl}/api/opportunities/${oppUpcomingId}/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    const vol1CancelData = await vol1CancelRes.json();
    assert(
      vol1CancelRes.status === 200 &&
        vol1CancelData.status === 'success' &&
        vol1CancelData.data?.signup?.status === 'CANCELLED',
      'Test 6: Volunteer 1 successfully cancels own signup via DELETE /opportunities/:opportunityId/signup (200 OK)'
    );

    // Verify DB row status
    const dbSignupRow = await pool.query(
      `SELECT status FROM signups WHERE id = $1`,
      [signup1Id]
    );
    assert(
      dbSignupRow.rows[0]?.status === 'CANCELLED',
      'Test 7: Database row status confirmed updated to CANCELLED'
    );

    // Test 8: Repeated cancellation returns 400 Bad Request
    const repeatCancelRes = await fetch(
      `${baseUrl}/api/opportunities/${oppUpcomingId}/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    const repeatCancelData = await repeatCancelRes.json();
    assert(
      repeatCancelRes.status === 400 &&
        repeatCancelData.message?.includes('already cancelled'),
      'Test 8: Repeated cancellation returns 400 Bad Request (Signup is already cancelled)'
    );

    // Test 9: Handling opportunity ID vs signup ID:
    // Sending signupId to DELETE /api/opportunities/:id/signup returns 404 (because no opp exists with that ID)
    const signupIdAsOppRes = await fetch(
      `${baseUrl}/api/opportunities/${signup1Id}/signup`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      signupIdAsOppRes.status === 404,
      'Test 9: Passing a signup ID to DELETE /opportunities/:opportunityId/signup returns 404'
    );

    // Test 10: Existing PATCH /api/signups/:id/cancel remains fully functional
    // Volunteer 2 signs up for oppUpcomingId, then cancels via existing PATCH endpoint
    const signup2Res = await signUpVolunteer(tokenVol2, oppUpcomingId);
    const signup2Id = signup2Res.data?.signup?.id;
    const patchCancelRes = await fetch(
      `${baseUrl}/api/signups/${signup2Id}/cancel`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenVol2}`,
        },
      }
    );
    const patchCancelData = await patchCancelRes.json();
    assert(
      patchCancelRes.status === 200 &&
        patchCancelData.data?.signup?.status === 'CANCELLED',
      'Test 10: Existing PATCH /api/signups/:signupId/cancel remains operational (200 OK)'
    );

    // =========================================================================
    // TASK 2: FIX MY SIGNUPS API INTEGRATION (GET /api/signups/my & alias)
    // =========================================================================
    console.log(`\n${colors.bold}--- TASK 2: My Signups API Integration ---${colors.reset}`);

    // Test 11: Unauthenticated GET /api/signups/my returns 401
    const unauthMyRes = await fetch(`${baseUrl}/api/signups/my`);
    assert(
      unauthMyRes.status === 401,
      'Test 11: Unauthenticated GET /api/signups/my returns 401'
    );

    // Test 12: Coordinator cannot access GET /api/signups/my (403 Forbidden)
    const coordMyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      coordMyRes.status === 403,
      'Test 12: Coordinator access to GET /api/signups/my returns 403 Forbidden'
    );

    // Test 13: Volunteer retrieves signups via GET /api/signups/my
    const vol1MyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const vol1MyData = await vol1MyRes.json();
    assert(
      vol1MyRes.status === 200 &&
        Array.isArray(vol1MyData.data?.signups) &&
        Array.isArray(vol1MyData.data?.opportunities) &&
        vol1MyData.data.signups.length >= 1,
      'Test 13: GET /api/signups/my returns 200 OK with signups & opportunities arrays'
    );

    // Test 14: Signup record contains joined opportunity metadata and opportunity_id
    const record = vol1MyData.data?.signups[0];
    assert(
      record &&
        record.id !== undefined &&
        record.opportunity_id !== undefined &&
        record.opportunity_title !== undefined &&
        record.status !== undefined,
      'Test 14: Signup record includes id, opportunity_id, status, and joined opportunity_title'
    );

    // Test 15: Alias GET /api/opportunities/my-signups returns 200 for volunteer
    const aliasMyRes = await fetch(`${baseUrl}/api/opportunities/my-signups`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const aliasMyData = await aliasMyRes.json();
    assert(
      aliasMyRes.status === 200 &&
        Array.isArray(aliasMyData.data?.signups) &&
        aliasMyData.data.signups.length >= 1,
      'Test 15: Alias GET /api/opportunities/my-signups returns 200 OK with identical shape'
    );

    // Test 16: Coordinator rejected from alias GET /api/opportunities/my-signups (403 Forbidden)
    const coordAliasRes = await fetch(`${baseUrl}/api/opportunities/my-signups`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      coordAliasRes.status === 403,
      'Test 16: Coordinator access to alias GET /api/opportunities/my-signups returns 403 Forbidden'
    );

    // Test 17: Volunteer identity is derived from token (Bob does not see Alice's signups)
    const vol2MyRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol2}` },
    });
    const vol2MyData = await vol2MyRes.json();
    const vol2SignupIds = vol2MyData.data?.signups?.map((s) => s.id) || [];
    assert(
      vol2MyRes.status === 200 && !vol2SignupIds.includes(signup1Id),
      'Test 17: Volunteer identity derived from JWT: Bob cannot see Alice signup record'
    );

    // =========================================================================
    // TASK 3: CONNECT LIVE DASHBOARD STATISTICS (GET /api/opportunities/dashboard-stats)
    // =========================================================================
    console.log(`\n${colors.bold}--- TASK 3: Live Dashboard Statistics ---${colors.reset}`);

    // Test 18: Unauthenticated request returns 401
    const unauthStatsRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`);
    assert(
      unauthStatsRes.status === 401,
      'Test 18: Unauthenticated GET /api/opportunities/dashboard-stats returns 401'
    );

    // Test 19: Coordinator with no organizations receives zeroed statistics
    const emptyCoordStatsRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const emptyCoordStatsData = await emptyCoordStatsRes.json();
    assert(
      emptyCoordStatsRes.status === 200 &&
        emptyCoordStatsData.data?.stats?.organizations_count === 0 &&
        emptyCoordStatsData.data?.stats?.active_opportunities === 0 &&
        emptyCoordStatsData.data?.stats?.total_volunteers_registered === 0,
      'Test 19: Coordinator with no data receives real zero counts { orgs: 0, opps: 0, vols: 0 }'
    );

    // Prepare fresh volunteer for clean volunteer statistics verification
    const volunteerStatsTest = {
      full_name: 'Volunteer Charlie Stats',
      email: `vol3.stats.${timestamp}@test.org`,
      password: 'Password123!',
      role: 'VOLUNTEER',
    };
    testEmails.push(volunteerStatsTest.email);
    await registerUser(volunteerStatsTest);
    const volStatsLogin = await loginUser(volunteerStatsTest.email, volunteerStatsTest.password);
    const tokenVolStats = volStatsLogin.data?.token;

    // Test 20: Fresh volunteer with no signups/hours receives zeroed statistics
    const emptyVolStatsRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tokenVolStats}` },
    });
    const emptyVolStatsData = await emptyVolStatsRes.json();
    assert(
      emptyVolStatsRes.status === 200 &&
        emptyVolStatsData.data?.stats?.upcoming_count === 0 &&
        emptyVolStatsData.data?.stats?.completed_count === 0 &&
        emptyVolStatsData.data?.stats?.total_hours === 0,
      'Test 20: Volunteer with no activity receives real zero counts { upcoming: 0, completed: 0, hours: 0 }'
    );

    // Setup live activity for Volunteer Charlie:
    // 1. Sign up for upcoming opportunity (oppUpcomingId: 2028-05-20)
    const charlieSignup1 = await signUpVolunteer(tokenVolStats, oppUpcomingId);
    const charlieSignup1Id = charlieSignup1.data?.signup?.id;

    // 2. Sign up for completed opportunity (oppCompletedId: 2024-01-10)
    // Note: status is COMPLETED or event_date in the past. To sign up directly in test, insert signup row:
    const charlieSignupPast = await pool.query(
      `INSERT INTO signups (volunteer_id, opportunity_id, status)
       VALUES ((SELECT id FROM users WHERE email = $1), $2, 'REGISTERED')
       RETURNING id`,
      [volunteerStatsTest.email, oppCompletedId]
    );
    const charlieSignupPastId = charlieSignupPast.rows[0].id;

    // 3. Record volunteer hours for charlieSignupPastId:
    // 4 hours verified, 2 hours recorded
    await pool.query(
      `INSERT INTO volunteer_hours (signup_id, hours, status, recorded_by)
       VALUES ($1, 4.50, 'VERIFIED', (SELECT id FROM users WHERE email = $2)),
              ($1, 2.00, 'RECORDED', (SELECT id FROM users WHERE email = $2))`,
      [charlieSignupPastId, coordinator1.email]
    );

    // Test 21: Live Volunteer statistics calculations
    const liveVolStatsRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tokenVolStats}` },
    });
    const liveVolStatsData = await liveVolStatsRes.json();
    const volStats = liveVolStatsData.data?.stats;
    assert(
      liveVolStatsRes.status === 200 &&
        volStats?.upcoming_count === 1 &&
        volStats?.completed_count === 1 &&
        volStats?.total_hours === 4.5,
      `Test 21: Volunteer live stats accurate (upcoming: 1, completed: 1, verified hours: 4.5). Received: ${JSON.stringify(volStats)}`
    );

    // Test 22: Cancelled signup does not count toward upcoming commitments
    // Cancel Charlie's upcoming signup
    await fetch(`${baseUrl}/api/opportunities/${oppUpcomingId}/signup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenVolStats}` },
    });
    const afterCancelVolStatsRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tokenVolStats}` },
    });
    const afterCancelVolStatsData = await afterCancelVolStatsRes.json();
    assert(
      afterCancelVolStatsData.data?.stats?.upcoming_count === 0,
      'Test 22: Cancelled signups are accurately excluded from upcoming_count'
    );

    // Test 23: Cancelled opportunities (status = 'CANCELLED') excluded from completed_count
    const oppCancelledPastId = await createOpp(tokenCoord1, org1Id, 'Cancelled Historical Drive', {
      event_date: '2023-01-15',
      status: 'CANCELLED',
    });
    await pool.query(
      `INSERT INTO signups (volunteer_id, opportunity_id, status)
       VALUES ((SELECT id FROM users WHERE email = $1), $2, 'REGISTERED')`,
      [volunteerStatsTest.email, oppCancelledPastId]
    );
    const afterCancelledOppRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tokenVolStats}` },
    });
    const afterCancelledOppData = await afterCancelledOppRes.json();
    assert(
      afterCancelledOppData.data?.stats?.completed_count === 1,
      'Test 23: Cancelled opportunities are excluded from completed_count even if date has passed'
    );

    // Test 24: Coordinator 1 live statistics calculations
    // Coordinator 1 has:
    // - 1 Organization (Green Earth Initiative)
    // - 1 Published opportunity (oppUpcomingId is PUBLISHED, oppCompletedId is COMPLETED, oppDraftId is DRAFT, oppCancelledPastId is CANCELLED)
    // - Total active signups: charlieSignupPastId is registered for oppCompletedId (oppCancelledPastId is also counted if status='REGISTERED')
    const coord1StatsRes = await fetch(`${baseUrl}/api/opportunities/dashboard-stats`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const coord1StatsData = await coord1StatsRes.json();
    const coordStats = coord1StatsData.data?.stats;
    assert(
      coord1StatsRes.status === 200 &&
        coordStats?.organizations_count === 1 &&
        coordStats?.active_opportunities === 1 &&
        coordStats?.total_volunteers_registered === 2,
      `Test 24: Coordinator live stats accurate (orgs: 1, published opps: 1, registered signups: 2). Received: ${JSON.stringify(coordStats)}`
    );

    // Test 25: Role shape isolation - Volunteer does not receive coordinator keys
    assert(
      volStats?.organizations_count === undefined &&
        volStats?.active_opportunities === undefined,
      'Test 25: Volunteer statistics response does not leak coordinator metrics'
    );
    // Test 26: Role shape isolation - Coordinator does not receive volunteer keys
    assert(
      coordStats?.upcoming_count === undefined &&
        coordStats?.completed_count === undefined,
      'Test 26: Coordinator statistics response does not leak volunteer metrics'
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
    console.log(`  BATCH 1 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`-------------------------------------------------------------${colors.reset}\n`);

    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
