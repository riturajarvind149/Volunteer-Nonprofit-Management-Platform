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
  console.log(`  DAY 26: VOLUNTEER DATE-BASED HOURS RETRIEVAL TEST SUITE    `);
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
    full_name: 'MyDate Coordinator',
    email: `coord.mydate.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'MyDate Volunteer Alice',
    email: `vol1.mydate.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'MyDate Volunteer Bob',
    email: `vol2.mydate.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [
    coordinator.email,
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

    // Register helper
    const registerUser = async (userObj) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userObj),
      });
      return await res.json();
    };

    // Login helper
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
    await registerUser(coordinator);
    await registerUser(volunteer1);
    await registerUser(volunteer2);

    // Login users
    const { token: tokenCoord } = await loginUser(coordinator.email, coordinator.password);
    const { token: tokenVol1, user: userVol1 } = await loginUser(volunteer1.email, volunteer1.password);
    const { token: tokenVol2, user: userVol2 } = await loginUser(volunteer2.email, volunteer2.password);

    // Create Organization (Coordinator)
    const orgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`,
      },
      body: JSON.stringify({
        name: 'Heritage Community Center',
        description: 'Supporting neighborhood enrichment',
      }),
    });
    const orgData = await orgRes.json();
    const orgId = orgData.data.organization.id;

    // Opportunity creation helper
    const createOpp = async (title) => {
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
          event_date: '2026-11-20',
          start_time: '09:00:00',
          end_time: '13:00:00',
          location: 'Center Hall',
          address: '100 Heritage Ave',
          capacity: 20,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    const opp1Id = await createOpp('Community Garden Care');
    const opp2Id = await createOpp('Neighborhood Book Drive');

    // Signup helper
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

    // Record hours helper
    const recordHours = async (signupId, hours, status) => {
      const res = await fetch(`${baseUrl}/api/signups/${signupId}/hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCoord}`,
        },
        body: JSON.stringify({ hours, status }),
      });
      return await res.json();
    };

    // Signups for Vol 1:
    const signup1A_Alice = await createSignup(tokenVol1, opp1Id);
    const signup1B_Alice = await createSignup(tokenVol1, opp2Id);

    // Signups for Vol 2:
    const signup2A_Bob = await createSignup(tokenVol2, opp1Id);

    // Record hours for Vol 1:
    // Rec 1 (Alice): 4.0 VERIFIED
    const rec1Data = await recordHours(signup1A_Alice, 4.0, 'VERIFIED');
    const rec1Id = rec1Data.data.volunteer_hours.id;

    // Rec 2 (Alice): 2.5 RECORDED
    const rec2Data = await recordHours(signup1A_Alice, 2.5, 'RECORDED');
    const rec2Id = rec2Data.data.volunteer_hours.id;

    // Rec 3 (Alice): 3.0 PENDING
    const rec3Data = await recordHours(signup1B_Alice, 3.0, 'PENDING');
    const rec3Id = rec3Data.data.volunteer_hours.id;

    // Rec 4 (Alice, Leap Year date): 1.5 RECORDED
    const rec4Data = await recordHours(signup1B_Alice, 1.5, 'RECORDED');
    const rec4Id = rec4Data.data.volunteer_hours.id;

    // Record hours for Vol 2 (Bob): 5.0 VERIFIED
    const rec5Data = await recordHours(signup2A_Bob, 5.0, 'VERIFIED');
    const rec5Id = rec5Data.data.volunteer_hours.id;

    // Set precise created_at timestamps on volunteer_hours:
    // Rec 1: 2026-09-05T10:00:00Z (September 2026)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-09-05 10:00:00Z' WHERE id = $1`, [rec1Id]);
    // Rec 2: 2026-10-15T14:00:00Z (October 2026)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-10-15 14:00:00Z' WHERE id = $1`, [rec2Id]);
    // Rec 3: 2026-11-20T09:00:00Z (November 2026)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-11-20 09:00:00Z' WHERE id = $1`, [rec3Id]);
    // Rec 4: 2024-02-29T12:00:00Z (Leap Year February 29)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2024-02-29 12:00:00Z' WHERE id = $1`, [rec4Id]);
    // Rec 5 (Bob): 2026-10-15T15:00:00Z (October 2026)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-10-15 15:00:00Z' WHERE id = $1`, [rec5Id]);

    console.log(`Test setup completed with 2 opportunities and 5 timestamped hour records.\n`);

    // ================================================================
    // Group 1: Authentication & Authorization Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated request rejected -> 401
    const unauthRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-09-01`);
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated request to GET /api/hours/my returns 401 Unauthorized'
    );

    // Test 2: Invalid JWT token rejected -> 401
    const invalidTokenRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-09-01`, {
      headers: { Authorization: 'Bearer bad.token.here' },
    });
    assert(
      invalidTokenRes.status === 401,
      'Test 2: Invalid JWT token returns 401 Unauthorized'
    );

    // Test 3: Coordinator cannot access volunteer endpoint -> 403
    const coordRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-09-01`, {
      headers: { Authorization: `Bearer ${tokenCoord}` },
    });
    assert(
      coordRes.status === 403,
      'Test 3: Coordinator accessing GET /api/hours/my returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Date Input Validation (400 Bad Request)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Date Input Validation (400 Bad Request)${colors.reset}`);

    // Test 4: Invalid date format (MM-DD-YYYY) -> 400
    const invFormatRes = await fetch(`${baseUrl}/api/hours/my?from_date=09-05-2026`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      invFormatRes.status === 400,
      'Test 4: Invalid date format (MM-DD-YYYY) returns 400 Bad Request'
    );

    // Test 5: Date format with slashes -> 400
    const slashRes = await fetch(`${baseUrl}/api/hours/my?to_date=2026/09/30`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      slashRes.status === 400,
      'Test 5: Date format with slashes (YYYY/MM/DD) returns 400 Bad Request'
    );

    // Test 6: Impossible calendar date (Feb 30) -> 400
    const impFebRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-02-30`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      impFebRes.status === 400,
      'Test 6: Impossible calendar date 2026-02-30 returns 400 Bad Request'
    );

    // Test 7: Impossible calendar date (April 31) -> 400
    const impAprRes = await fetch(`${baseUrl}/api/hours/my?to_date=2026-04-31`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      impAprRes.status === 400,
      'Test 7: Impossible calendar date 2026-04-31 returns 400 Bad Request'
    );

    // Test 8: Impossible month (Month 13) -> 400
    const impMonthRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-13-01`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      impMonthRes.status === 400,
      'Test 8: Impossible month 2026-13-01 returns 400 Bad Request'
    );

    // Test 9: Invalid non-leap Feb 29 (2026-02-29) -> 400
    const nonLeapRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-02-29`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      nonLeapRes.status === 400,
      'Test 9: Invalid non-leap Feb 29 (2026-02-29) returns 400 Bad Request'
    );

    // Test 10: from_date greater than to_date -> 400
    const invRangeRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2026-11-01&to_date=2026-10-01`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      invRangeRes.status === 400,
      'Test 10: from_date greater than to_date returns 400 Bad Request'
    );

    // ================================================================
    // Group 3: Unfiltered Reporting (Preserve Existing Behavior)
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Unfiltered Reporting (Preserve Existing Behavior)${colors.reset}`);

    // Test 11: No date filters preserves all existing records and response structure
    const unfiltRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const unfiltData = await unfiltRes.json();
    const unfiltList = unfiltData.data?.volunteer_hours || unfiltData.data?.hours;

    assert(
      unfiltRes.status === 200 &&
        unfiltData.status === 'success' &&
        Array.isArray(unfiltList) &&
        unfiltList.length === 4,
      `Test 11: No date filters returns all 4 volunteer records across time`
    );

    // Test 12: Existing response structure remains compatible
    const sampleRecord = unfiltList?.[0];
    const hasRequiredFields =
      sampleRecord &&
      sampleRecord.id !== undefined &&
      sampleRecord.signup_id !== undefined &&
      sampleRecord.opportunity_id !== undefined &&
      sampleRecord.opportunity_title !== undefined &&
      sampleRecord.organization_id !== undefined &&
      sampleRecord.organization_name !== undefined &&
      sampleRecord.hours !== undefined &&
      sampleRecord.status !== undefined &&
      sampleRecord.recorded_by !== undefined &&
      sampleRecord.created_at !== undefined &&
      sampleRecord.updated_at !== undefined;

    assert(
      hasRequiredFields,
      'Test 12: Response structure preserves id, signup_id, opportunity_title, org details, hours, status, created_at'
    );

    // ================================================================
    // Group 4: Date-Range Filtering (from_date, to_date, both)
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Date-Range Filtering (from_date, to_date, both)${colors.reset}`);

    // Test 13: from_date only (from 2026-10-01 onward)
    // Alice has Oct 15 (2.5h) and Nov 20 (3.0h) -> 2 records
    const fromOnlyRes = await fetch(`${baseUrl}/api/hours/my?from_date=2026-10-01`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const fromOnlyData = await fromOnlyRes.json();
    const fromOnlyList = fromOnlyData.data?.volunteer_hours || fromOnlyData.data?.hours;

    assert(
      fromOnlyRes.status === 200 &&
        Array.isArray(fromOnlyList) &&
        fromOnlyList.length === 2 &&
        fromOnlyList.some((r) => r.id === rec2Id) &&
        fromOnlyList.some((r) => r.id === rec3Id) &&
        !fromOnlyList.some((r) => r.id === rec1Id) &&
        !fromOnlyList.some((r) => r.id === rec4Id),
      `Test 13: from_date only (>= 2026-10-01) retrieves strictly records from that date onward (found 2 records)`
    );

    // Test 14: to_date only (up to 2026-09-30)
    // Alice has Sept 05 (4.0h) and Feb 29 2024 (1.5h) -> 2 records
    const toOnlyRes = await fetch(`${baseUrl}/api/hours/my?to_date=2026-09-30`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const toOnlyData = await toOnlyRes.json();
    const toOnlyList = toOnlyData.data?.volunteer_hours || toOnlyData.data?.hours;

    assert(
      toOnlyRes.status === 200 &&
        Array.isArray(toOnlyList) &&
        toOnlyList.length === 2 &&
        toOnlyList.some((r) => r.id === rec1Id) &&
        toOnlyList.some((r) => r.id === rec4Id) &&
        !toOnlyList.some((r) => r.id === rec2Id) &&
        !toOnlyList.some((r) => r.id === rec3Id),
      `Test 14: to_date only (<= 2026-09-30) retrieves strictly records up to end of that date (found 2 records)`
    );

    // Test 15: Both from_date and to_date (October: 2026-10-01 to 2026-10-31)
    // Alice has only Oct 15 (2.5h) -> exactly 1 record
    const bothRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2026-10-01&to_date=2026-10-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    const bothData = await bothRes.json();
    const bothList = bothData.data?.volunteer_hours || bothData.data?.hours;

    assert(
      bothRes.status === 200 &&
        Array.isArray(bothList) &&
        bothList.length === 1 &&
        bothList[0].id === rec2Id &&
        parseFloat(bothList[0].hours) === 2.5,
      `Test 15: Both from_date and to_date (October 2026) retrieves strictly matching records (found 1 record, 2.5h)`
    );

    // Test 16: Valid leap-year date (2024-02-29 to 2024-02-29)
    // Alice has Rec 4 created on 2024-02-29 -> exactly 1 record
    const leapRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2024-02-29&to_date=2024-02-29`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    const leapData = await leapRes.json();
    const leapList = leapData.data?.volunteer_hours || leapData.data?.hours;

    assert(
      leapRes.status === 200 &&
        Array.isArray(leapList) &&
        leapList.length === 1 &&
        leapList[0].id === rec4Id &&
        parseFloat(leapList[0].hours) === 1.5,
      `Test 16: Valid leap-year date 2024-02-29 is accepted and retrieves matching records`
    );

    // Test 17: Date range with zero matching records returns HTTP 200 with empty array []
    const emptyRangeRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2025-01-01&to_date=2025-01-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    const emptyRangeData = await emptyRangeRes.json();
    const emptyRangeList = emptyRangeData.data?.volunteer_hours || emptyRangeData.data?.hours;

    assert(
      emptyRangeRes.status === 200 &&
        Array.isArray(emptyRangeList) &&
        emptyRangeList.length === 0,
      `Test 17: Date range with zero matching records returns HTTP 200 with empty array []`
    );

    // ================================================================
    // Group 5: Ownership Isolation & Anti-Spoofing
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Ownership Isolation & Anti-Spoofing${colors.reset}`);

    // Test 18: Volunteer 1 can retrieve only their own records (never sees Bob's Rec 5)
    const hasBobRecord = unfiltList.some((r) => r.id === rec5Id);
    assert(
      !hasBobRecord,
      "Test 18: Volunteer 1 cannot see Volunteer 2's records (isolated)"
    );

    // Test 19: Volunteer 2 strictly retrieves only their own records
    const vol2Res = await fetch(
      `${baseUrl}/api/hours/my?from_date=2026-10-01&to_date=2026-10-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol2}` },
      }
    );
    const vol2Data = await vol2Res.json();
    const vol2List = vol2Data.data?.volunteer_hours || vol2Data.data?.hours;

    assert(
      vol2Res.status === 200 &&
        Array.isArray(vol2List) &&
        vol2List.length === 1 &&
        vol2List[0].id === rec5Id &&
        parseFloat(vol2List[0].hours) === 5.0,
      `Test 19: Volunteer 2 strictly retrieves only their own hours record (found 1 record, 5.0h)`
    );

    // Test 20: Anti-spoofing: volunteer_id query parameter is ignored
    const spoofRes = await fetch(
      `${baseUrl}/api/hours/my?volunteer_id=${userVol2.id}&from_date=2026-10-01&to_date=2026-10-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    const spoofData = await spoofRes.json();
    const spoofList = spoofData.data?.volunteer_hours || spoofData.data?.hours;

    assert(
      spoofRes.status === 200 &&
        Array.isArray(spoofList) &&
        spoofList.length === 1 &&
        spoofList[0].id === rec2Id,
      'Test 20: Anti-spoofing: Query parameter volunteer_id is ignored and req.user.id is enforced'
    );

    // Test 21: Data security: response does NOT expose password or password_hash
    const rawResBody = JSON.stringify(bothData);
    assert(
      !rawResBody.includes('password') && !rawResBody.includes('password_hash'),
      'Test 21: Response does NOT leak password or password_hash'
    );

    // ================================================================
    // Group 6: Regression & Non-Breakage of Existing Endpoints
    // ================================================================
    console.log(`\n${colors.bold}Group 6: Regression & Non-Breakage of Existing Endpoints${colors.reset}`);

    // Test 22: Day 20 POST /api/signups/:id/hours remains operational (201 Created)
    const regRecordRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`,
      },
      body: JSON.stringify({ hours: 1.0, status: 'RECORDED' }),
    });
    const regRecordData = await regRecordRes.json();
    const regHourId = regRecordData.data?.volunteer_hours?.id;
    assert(
      regRecordRes.status === 201 && regHourId !== undefined,
      'Test 22: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 23: Day 21 GET /api/hours/organization remains operational (200 OK)
    const regOrgRes = await fetch(`${baseUrl}/api/hours/organization`, {
      headers: { Authorization: `Bearer ${tokenCoord}` },
    });
    const regOrgData = await regOrgRes.json();
    const regOrgList = regOrgData.data?.volunteer_hours || regOrgData.data?.hours;
    assert(
      regOrgRes.status === 200 && Array.isArray(regOrgList) && regOrgList.length >= 5,
      'Test 23: Day 21 GET /api/hours/organization remains operational (200 OK)'
    );

    // Test 24: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)
    const regPatchRes = await fetch(`${baseUrl}/api/hours/${regHourId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      regPatchRes.status === 200,
      'Test 24: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 25: Day 23 GET /api/hours/my/summary remains operational (200 OK)
    const regMySummaryRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const regMySummaryData = await regMySummaryRes.json();
    const regMySum = regMySummaryData.data?.summary || regMySummaryData.data;
    assert(
      regMySummaryRes.status === 200 && typeof regMySum?.total_hours === 'number',
      'Test 25: Day 23 GET /api/hours/my/summary remains operational (200 OK)'
    );

    // Test 26: Day 24 & 25 Coordinator opportunities reporting with date filters remains operational (200 OK)
    const coordOppRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-09-01&to_date=2026-10-31`,
      {
        headers: { Authorization: `Bearer ${tokenCoord}` },
      }
    );
    const coordOppData = await coordOppRes.json();
    const coordOppList = coordOppData.data?.opportunities || coordOppData.data?.opportunity_hours;
    assert(
      coordOppRes.status === 200 && Array.isArray(coordOppList) && coordOppList.length === 2,
      'Test 26: Day 24 & 25 GET /api/hours/organization/opportunities remains fully operational with date filters'
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
  console.log(`  DAY 26 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
