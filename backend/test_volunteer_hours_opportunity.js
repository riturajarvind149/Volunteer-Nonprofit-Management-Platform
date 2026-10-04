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
  console.log(`  DAY 24: OPPORTUNITY-WISE VOLUNTEER HOURS REPORTING SUITE   `);
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
    full_name: 'OppRep Coordinator One',
    email: `coord1.opprep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'OppRep Coordinator Two',
    email: `coord2.opprep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinatorEmpty = {
    full_name: 'OppRep Coordinator Empty',
    email: `coordempty.opprep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'OppRep Volunteer Alice',
    email: `vol1.opprep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'OppRep Volunteer Bob',
    email: `vol2.opprep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator1.email,
    coordinator2.email,
    coordinatorEmpty.email,
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

    // Login users
    const { token: tokenCoord1, user: userCoord1 } = await loginUser(coordinator1.email, coordinator1.password);
    const { token: tokenCoord2, user: userCoord2 } = await loginUser(coordinator2.email, coordinator2.password);
    const { token: tokenCoordEmpty } = await loginUser(coordinatorEmpty.email, coordinatorEmpty.password);
    const { token: tokenVol1, user: userVol1 } = await loginUser(volunteer1.email, volunteer1.password);
    const { token: tokenVol2, user: userVol2 } = await loginUser(volunteer2.email, volunteer2.password);

    // Create Organization 1 (Coord 1)
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Community Care Foundation',
        description: 'Empowering local communities',
      }),
    });
    const org1Data = await org1Res.json();
    const org1Id = org1Data.data.organization.id;

    // Create Organization 2 (Coord 2)
    const org2Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        name: 'Animal Rescue Alliance',
        description: 'Protecting and caring for animals',
      }),
    });
    const org2Data = await org2Res.json();
    const org2Id = org2Data.data.organization.id;

    // Organization for Empty Coordinator (has org but no opportunities)
    const orgEmptyRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordEmpty}`,
      },
      body: JSON.stringify({
        name: 'Empty Youth Center',
        description: 'No events yet',
      }),
    });
    await orgEmptyRes.json();

    // Helper: create opportunity
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
          description: `Description for ${title}`,
          category: 'Community',
          event_date: '2026-11-20',
          start_time: '09:00:00',
          end_time: '13:00:00',
          location: 'Main Park',
          address: '123 Main St',
          capacity: 20,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    // Coord 1 creates 3 opportunities:
    // Opp 1A: has multiple hour records
    const opp1AId = await createOpp(tokenCoord1, org1Id, 'Tree Planting Day');
    // Opp 1B: has signups but NO hours
    const opp1BId = await createOpp(tokenCoord1, org1Id, 'Food Bank Packing');
    // Opp 1C: has NO signups and NO hours
    const opp1CId = await createOpp(tokenCoord1, org1Id, 'Park Cleanup Event');

    // Coord 2 creates 1 opportunity:
    const opp2AId = await createOpp(tokenCoord2, org2Id, 'Shelter Pet Grooming');

    // Helper: volunteer signs up
    const createSignup = async (token, oppId) => {
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

    // Helper: record hours
    const recordHours = async (token, signupId, hours, status) => {
      const res = await fetch(`${baseUrl}/api/signups/${signupId}/hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hours, status }),
      });
      return await res.json();
    };

    // Signups for Opp 1A:
    const signup1A_Alice = await createSignup(tokenVol1, opp1AId);
    const signup1A_Bob = await createSignup(tokenVol2, opp1AId);

    // Record hours for Opp 1A:
    // Alice: 4.0 VERIFIED
    await recordHours(tokenCoord1, signup1A_Alice, 4.0, 'VERIFIED');
    // Bob: 3.0 RECORDED
    await recordHours(tokenCoord1, signup1A_Bob, 3.0, 'RECORDED');
    // Bob: 1.5 PENDING
    await recordHours(tokenCoord1, signup1A_Bob, 1.5, 'PENDING');

    // Signups for Opp 1B (signup exists, but NO hours recorded):
    await createSignup(tokenVol1, opp1BId);

    // Opp 1C has no signups and no hours.

    // Signups for Opp 2A (Coord 2):
    const signup2A_Alice = await createSignup(tokenVol1, opp2AId);
    // Record hours for Opp 2A: Alice: 2.5 VERIFIED
    await recordHours(tokenCoord2, signup2A_Alice, 2.5, 'VERIFIED');

    console.log(`Test setup completed with 4 opportunities and 4 recorded hour entries.\n`);

    // ================================================================
    // Group 1: Authentication & Authorization Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/api/hours/organization/opportunities`);
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated GET /api/hours/organization/opportunities returns 401 Unauthorized'
    );

    // Test 2: Invalid JWT -> 401
    const invalidJwtRes = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    assert(
      invalidJwtRes.status === 401,
      'Test 2: Invalid JWT token returns 401 Unauthorized'
    );

    // Test 3: Volunteer accessing coordinator opportunity report -> 403
    const volRes = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      volRes.status === 403,
      'Test 3: Volunteer accessing GET /api/hours/organization/opportunities returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Coordinator Organization Opportunities Reporting
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Coordinator Organization Opportunities Reporting${colors.reset}`);

    // Test 4: Coordinator 1 retrieves opportunities summary successfully (200 OK)
    const coord1Res = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const coord1Data = await coord1Res.json();
    const oppList1 = coord1Data.data?.opportunities || coord1Data.data?.opportunity_hours;

    assert(
      coord1Res.status === 200 && coord1Data.status === 'success' && Array.isArray(oppList1),
      'Test 4: Coordinator 1 retrieves opportunities summary successfully with HTTP 200 OK'
    );

    // Test 5: Response contains all 3 opportunities created by Coordinator 1
    assert(
      oppList1.length === 3,
      `Test 5: Response contains all 3 opportunities owned by Coordinator 1 (found ${oppList1.length})`
    );

    // Find each opportunity summary
    const summary1A = oppList1.find((o) => o.opportunity_id === opp1AId);
    const summary1B = oppList1.find((o) => o.opportunity_id === opp1BId);
    const summary1C = oppList1.find((o) => o.opportunity_id === opp1CId);

    // Test 6: Opportunity 1A total_hours is correct (4.0 + 3.0 + 1.5 = 8.5)
    assert(
      summary1A && summary1A.total_hours === 8.5,
      `Test 6: Opportunity 1A total_hours is correct (expected 8.5, got ${summary1A?.total_hours})`
    );

    // Test 7: Opportunity 1A total_volunteers is correct (2 distinct volunteers: Alice, Bob)
    assert(
      summary1A && summary1A.total_volunteers === 2,
      `Test 7: Opportunity 1A total_volunteers is correct (expected 2, got ${summary1A?.total_volunteers})`
    );

    // Test 8: Opportunity 1A status-wise hours correct (verified: 4.0, recorded: 3.0, pending: 1.5)
    assert(
      summary1A &&
        summary1A.verified_hours === 4.0 &&
        summary1A.recorded_hours === 3.0 &&
        summary1A.pending_hours === 1.5,
      `Test 8: Opportunity 1A status-wise hours correct (verified: ${summary1A?.verified_hours}, recorded: ${summary1A?.recorded_hours}, pending: ${summary1A?.pending_hours})`
    );

    // Test 9: Opportunity 1B (with signup but NO hours recorded) returns zero values
    assert(
      summary1B &&
        summary1B.total_volunteers === 0 &&
        summary1B.total_hours === 0 &&
        summary1B.verified_hours === 0 &&
        summary1B.recorded_hours === 0 &&
        summary1B.pending_hours === 0,
      `Test 9: Opportunity with signup but zero hours returns zeros (volunteers: ${summary1B?.total_volunteers}, hours: ${summary1B?.total_hours})`
    );

    // Test 10: Opportunity 1C (with no signups and no hours) returns zero values
    assert(
      summary1C &&
        summary1C.total_volunteers === 0 &&
        summary1C.total_hours === 0 &&
        summary1C.verified_hours === 0 &&
        summary1C.recorded_hours === 0 &&
        summary1C.pending_hours === 0,
      `Test 10: Opportunity with no signups and no hours returns zeros (volunteers: ${summary1C?.total_volunteers}, hours: ${summary1C?.total_hours})`
    );

    // Test 11: Response fields include required schema
    const requiredFields = [
      'opportunity_id',
      'opportunity_title',
      'organization_id',
      'organization_name',
      'total_volunteers',
      'total_hours',
      'verified_hours',
      'recorded_hours',
      'pending_hours',
    ];
    const hasAllFields = requiredFields.every((f) => summary1A && summary1A[f] !== undefined);
    assert(
      hasAllFields && summary1A.opportunity_title === 'Tree Planting Day' && summary1A.organization_name === 'Community Care Foundation',
      'Test 11: Summary entry contains opportunity_id, title, organization_id, organization_name, and all metric fields'
    );

    // ================================================================
    // Group 3: Multi-Tenant Ownership & Isolation
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Multi-Tenant Ownership & Isolation${colors.reset}`);

    // Test 12: Coordinator 1 does not see Opportunity 2A (owned by Coordinator 2)
    const containsOpp2A = oppList1.some((o) => o.opportunity_id === opp2AId);
    assert(
      !containsOpp2A,
      "Test 12: Ownership isolation: Coordinator 1 cannot see Coordinator 2's opportunity"
    );

    // Test 13: Coordinator 2 strictly retrieves only Opportunity 2A with correct metrics
    const coord2Res = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: `Bearer ${tokenCoord2}` },
    });
    const coord2Data = await coord2Res.json();
    const oppList2 = coord2Data.data?.opportunities || coord2Data.data?.opportunity_hours;
    const summary2A = oppList2?.find((o) => o.opportunity_id === opp2AId);

    assert(
      coord2Res.status === 200 &&
        Array.isArray(oppList2) &&
        oppList2.length === 1 &&
        summary2A &&
        summary2A.total_hours === 2.5 &&
        summary2A.verified_hours === 2.5 &&
        summary2A.total_volunteers === 1,
      `Test 13: Coordinator 2 strictly retrieves only their opportunity with correct metrics (volunteers: 1, hours: 2.5)`
    );

    // Test 14: Coordinator 2 cannot see any opportunities belonging to Coordinator 1
    const coord2HasCoord1Opps = oppList2.some(
      (o) => o.opportunity_id === opp1AId || o.opportunity_id === opp1BId || o.opportunity_id === opp1CId
    );
    assert(
      !coord2HasCoord1Opps,
      "Test 14: Ownership isolation: Coordinator 2 cannot see Coordinator 1's opportunities"
    );

    // Test 15: Anti-spoofing: passing coordinator_id or organization_id in query params is ignored
    const spoofRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?coordinator_id=${userCoord2.id}&organization_id=${org2Id}`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    const spoofData = await spoofRes.json();
    const spoofList = spoofData.data?.opportunities || spoofData.data?.opportunity_hours;
    assert(
      spoofList.length === 3 && spoofList.every((o) => o.organization_id === org1Id),
      'Test 15: Anti-spoofing: Query parameters are ignored and req.user.id is strictly enforced'
    );

    // Test 16: Coordinator with zero opportunities receives HTTP 200 with an empty array []
    const emptyCoordRes = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: `Bearer ${tokenCoordEmpty}` },
    });
    const emptyCoordData = await emptyCoordRes.json();
    const emptyList = emptyCoordData.data?.opportunities || emptyCoordData.data?.opportunity_hours;

    assert(
      emptyCoordRes.status === 200 &&
        emptyCoordData.status === 'success' &&
        Array.isArray(emptyList) &&
        emptyList.length === 0,
      'Test 16: Coordinator with zero opportunities receives HTTP 200 with an empty array []'
    );

    // ================================================================
    // Group 4: Regression of Existing Functionality (Days 20, 21, 22, 23)
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Regression of Existing Functionality (Days 20, 21, 22, 23)${colors.reset}`);

    // Test 17: Day 20 POST /api/signups/:id/hours remains operational (201 Created)
    const regRecordRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 1.0, status: 'RECORDED' }),
    });
    const regRecordData = await regRecordRes.json();
    const regHourId = regRecordData.data?.volunteer_hours?.id;
    assert(
      regRecordRes.status === 201 && regHourId !== undefined,
      'Test 17: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 18: Day 21 GET /api/hours/my remains operational (200 OK)
    const regMyRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const regMyData = await regMyRes.json();
    const regMyList = regMyData.data?.volunteer_hours || regMyData.data?.hours;
    assert(
      regMyRes.status === 200 && Array.isArray(regMyList) && regMyList.length >= 2,
      'Test 18: Day 21 GET /api/hours/my remains operational (200 OK)'
    );

    // Test 19: Day 21 GET /api/hours/organization remains operational (200 OK)
    const regOrgRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const regOrgData = await regOrgRes.json();
    const regOrgList = regOrgData.data?.volunteer_hours || regOrgData.data?.hours;
    assert(
      regOrgRes.status === 200 && Array.isArray(regOrgList) && regOrgList.length >= 3,
      'Test 19: Day 21 GET /api/hours/organization remains operational (200 OK)'
    );

    // Test 20: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)
    const regPatchRes = await fetch(`${baseUrl}/api/hours/${regHourId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      regPatchRes.status === 200,
      'Test 20: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 21: Day 23 GET /api/hours/my/summary remains operational (200 OK)
    const regMySummaryRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const regMySummaryData = await regMySummaryRes.json();
    const regMySum = regMySummaryData.data?.summary || regMySummaryData.data;
    assert(
      regMySummaryRes.status === 200 && typeof regMySum?.total_hours === 'number',
      'Test 21: Day 23 GET /api/hours/my/summary remains operational (200 OK)'
    );

    // Test 22: Day 23 GET /api/hours/organization/summary remains operational (200 OK)
    const regOrgSummaryRes = await fetch(`${baseUrl}/api/hours/organization/summary`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const regOrgSummaryData = await regOrgSummaryRes.json();
    const regOrgSum = regOrgSummaryData.data?.summary || regOrgSummaryData.data;
    assert(
      regOrgSummaryRes.status === 200 && typeof regOrgSum?.total_hours === 'number' && typeof regOrgSum?.total_volunteers === 'number',
      'Test 22: Day 23 GET /api/hours/organization/summary remains operational (200 OK)'
    );

    // Test 23: Data security: responses do not leak password or password_hash
    const rawCoord1Body = JSON.stringify(coord1Data);
    assert(
      !rawCoord1Body.includes('password') && !rawCoord1Body.includes('password_hash'),
      'Test 23: Response does NOT leak password or password_hash'
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
  console.log(`  DAY 24 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
