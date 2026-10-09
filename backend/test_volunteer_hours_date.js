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
  console.log(`  DAY 25: DATE-BASED VOLUNTEER HOURS REPORTING TEST SUITE    `);
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
    full_name: 'DateRep Coordinator One',
    email: `coord1.daterep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'DateRep Coordinator Two',
    email: `coord2.daterep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'DateRep Volunteer Alice',
    email: `vol1.daterep.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'DateRep Volunteer Bob',
    email: `vol2.daterep.${timestamp}@test.org`,
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
    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(volunteer1);
    await registerUser(volunteer2);

    // Login users
    const { token: tokenCoord1 } = await loginUser(coordinator1.email, coordinator1.password);
    const { token: tokenCoord2 } = await loginUser(coordinator2.email, coordinator2.password);
    const { token: tokenVol1 } = await loginUser(volunteer1.email, volunteer1.password);
    const { token: tokenVol2 } = await loginUser(volunteer2.email, volunteer2.password);

    // Create Organization 1 (Coord 1)
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Evergreen Nature Reserve',
        description: 'Conservation and wildlife protection',
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
        name: 'Metro Food Pantry',
        description: 'Fighting hunger in the city',
      }),
    });
    const org2Data = await org2Res.json();
    const org2Id = org2Data.data.organization.id;

    // Opportunity creation helper
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
          category: 'Environment',
          event_date: '2026-11-20',
          start_time: '09:00:00',
          end_time: '13:00:00',
          location: 'Forest Trail',
          address: '789 Nature Way',
          capacity: 25,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    // Coord 1 creates 3 opportunities:
    const opp1AId = await createOpp(tokenCoord1, org1Id, 'Trail Restoration Day');
    const opp1BId = await createOpp(tokenCoord1, org1Id, 'Tree Nursery Planting');
    const opp1CId = await createOpp(tokenCoord1, org1Id, 'River Watershed Cleanup');

    // Coord 2 creates 1 opportunity:
    const opp2AId = await createOpp(tokenCoord2, org2Id, 'Pantry Food Distribution');

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

    // Opp 1A Signups:
    const signup1A_Alice = await createSignup(tokenVol1, opp1AId);
    const signup1A_Bob = await createSignup(tokenVol2, opp1AId);

    // Record hours for Opp 1A:
    // Record 1 (Alice): 4.0 VERIFIED
    const rec1Data = await recordHours(tokenCoord1, signup1A_Alice, 4.0, 'VERIFIED');
    const rec1Id = rec1Data.data.volunteer_hours.id;

    // Record 2 (Alice): 2.0 RECORDED
    const rec2Data = await recordHours(tokenCoord1, signup1A_Alice, 2.0, 'RECORDED');
    const rec2Id = rec2Data.data.volunteer_hours.id;

    // Record 3 (Bob): 3.5 PENDING
    const rec3Data = await recordHours(tokenCoord1, signup1A_Bob, 3.5, 'PENDING');
    const rec3Id = rec3Data.data.volunteer_hours.id;

    // Opp 1B Signup & Hour Record:
    const signup1B_Alice = await createSignup(tokenVol1, opp1BId);
    const rec4Data = await recordHours(tokenCoord1, signup1B_Alice, 5.0, 'VERIFIED');
    const rec4Id = rec4Data.data.volunteer_hours.id;

    // Opp 1C: No signups, no hours.

    // Opp 2A (Coord 2) Signup & Hour Record:
    const signup2A_Alice = await createSignup(tokenVol1, opp2AId);
    const rec5Data = await recordHours(tokenCoord2, signup2A_Alice, 3.0, 'VERIFIED');
    const rec5Id = rec5Data.data.volunteer_hours.id;

    // Set specific created_at timestamps on the volunteer_hours records for precise date-based filtering:
    // Rec 1: 2026-09-05T10:00:00Z (September)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-09-05 10:00:00Z' WHERE id = $1`, [rec1Id]);
    // Rec 2: 2026-10-15T14:00:00Z (October)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-10-15 14:00:00Z' WHERE id = $1`, [rec2Id]);
    // Rec 3: 2026-11-20T09:00:00Z (November)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-11-20 09:00:00Z' WHERE id = $1`, [rec3Id]);
    // Rec 4: 2026-10-10T12:00:00Z (October)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-10-10 12:00:00Z' WHERE id = $1`, [rec4Id]);
    // Rec 5: 2026-09-15T11:00:00Z (September, Coord 2)
    await pool.query(`UPDATE volunteer_hours SET created_at = '2026-09-15 11:00:00Z' WHERE id = $1`, [rec5Id]);

    console.log(`Test setup completed with 4 opportunities and 5 timestamped hour records.\n`);

    // ================================================================
    // Group 1: Authentication & Authorization Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?from_date=2026-09-01`);
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated request returns 401 Unauthorized'
    );

    // Test 2: Volunteer accessing coordinator endpoint -> 403
    const volRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?from_date=2026-09-01`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      volRes.status === 403,
      'Test 2: Volunteer accessing GET /api/hours/organization/opportunities returns 403 Forbidden'
    );

    // ================================================================
    // Group 2: Date Input Validation (400 Bad Request)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Date Input Validation (400 Bad Request)${colors.reset}`);

    // Test 3: Invalid format (not YYYY-MM-DD) -> 400
    const invFormatRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?from_date=09-01-2026`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      invFormatRes.status === 400,
      'Test 3: Invalid date format (MM-DD-YYYY) returns 400 Bad Request'
    );

    // Test 4: Slash format rejected -> 400
    const slashRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?to_date=2026/09/30`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      slashRes.status === 400,
      'Test 4: Date format with slashes (YYYY/MM/DD) returns 400 Bad Request'
    );

    // Test 5: Impossible date (Feb 30) -> 400
    const impFebRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?from_date=2026-02-30`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      impFebRes.status === 400,
      'Test 5: Impossible date 2026-02-30 returns 400 Bad Request'
    );

    // Test 6: Impossible date (April 31) -> 400
    const impAprRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?to_date=2026-04-31`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      impAprRes.status === 400,
      'Test 6: Impossible date 2026-04-31 (April has 30 days) returns 400 Bad Request'
    );

    // Test 7: Impossible month 13 -> 400
    const impMonthRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?from_date=2026-13-01`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      impMonthRes.status === 400,
      'Test 7: Impossible month 2026-13-01 returns 400 Bad Request'
    );

    // Test 8: Non-leap year Feb 29 (2026) -> 400
    const nonLeapRes = await fetch(`${baseUrl}/api/hours/organization/opportunities?from_date=2026-02-29`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      nonLeapRes.status === 400,
      'Test 8: Non-leap year Feb 29 (2026-02-29) returns 400 Bad Request'
    );

    // Test 9: Inverted range: from_date > to_date -> 400
    const invertedRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-11-01&to_date=2026-10-01`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    assert(
      invertedRes.status === 400,
      'Test 9: from_date after to_date (from_date > to_date) returns 400 Bad Request'
    );

    // ================================================================
    // Group 3: Unfiltered Reporting (Preserve Day 24 Behavior)
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Unfiltered Reporting (Preserve Day 24 Behavior)${colors.reset}`);

    // Test 10: No date filters preserves all existing opportunity summaries
    const unfiltRes = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const unfiltData = await unfiltRes.json();
    const unfiltOpps = unfiltData.data?.opportunities || unfiltData.data?.opportunity_hours;
    const opp1A_unfilt = unfiltOpps?.find((o) => o.opportunity_id === opp1AId);

    assert(
      unfiltRes.status === 200 &&
        unfiltOpps.length === 3 &&
        opp1A_unfilt.total_hours === 9.5 &&
        opp1A_unfilt.total_volunteers === 2 &&
        opp1A_unfilt.verified_hours === 4.0 &&
        opp1A_unfilt.recorded_hours === 2.0 &&
        opp1A_unfilt.pending_hours === 3.5,
      `Test 10: No date filter returns all records across time (opp1A: 9.5 hours, 2 volunteers)`
    );

    // ================================================================
    // Group 4: Date Range Filtering (from_date, to_date, both)
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Date Range Filtering (from_date, to_date, both)${colors.reset}`);

    // Test 11: from_date only (from 2026-10-01 onward)
    // Opp 1A has Oct 15 (2.0 RECORDED) and Nov 20 (3.5 PENDING) -> 5.5 hours, 2 volunteers
    // Opp 1B has Oct 10 (5.0 VERIFIED) -> 5.0 hours, 1 volunteer
    const fromOnlyRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-10-01`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    const fromOnlyData = await fromOnlyRes.json();
    const fromOnlyOpps = fromOnlyData.data?.opportunities || fromOnlyData.data?.opportunity_hours;
    const opp1A_fromOnly = fromOnlyOpps?.find((o) => o.opportunity_id === opp1AId);
    const opp1B_fromOnly = fromOnlyOpps?.find((o) => o.opportunity_id === opp1BId);

    assert(
      fromOnlyRes.status === 200 &&
        opp1A_fromOnly.total_hours === 5.5 &&
        opp1A_fromOnly.recorded_hours === 2.0 &&
        opp1A_fromOnly.pending_hours === 3.5 &&
        opp1A_fromOnly.verified_hours === 0 &&
        opp1A_fromOnly.total_volunteers === 2 &&
        opp1B_fromOnly.total_hours === 5.0 &&
        opp1B_fromOnly.verified_hours === 5.0,
      `Test 11: from_date only (>= 2026-10-01) includes only records from that date onward`
    );

    // Test 12: to_date only (up to 2026-09-30)
    // Opp 1A has Sept 05 (4.0 VERIFIED) -> 4.0 hours, 1 volunteer
    // Opp 1B has Oct 10 -> outside range, returns 0.0 hours
    // Opp 1C has no hours -> returns 0.0 hours
    const toOnlyRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?to_date=2026-09-30`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    const toOnlyData = await toOnlyRes.json();
    const toOnlyOpps = toOnlyData.data?.opportunities || toOnlyData.data?.opportunity_hours;
    const opp1A_toOnly = toOnlyOpps?.find((o) => o.opportunity_id === opp1AId);
    const opp1B_toOnly = toOnlyOpps?.find((o) => o.opportunity_id === opp1BId);

    assert(
      toOnlyRes.status === 200 &&
        opp1A_toOnly.total_hours === 4.0 &&
        opp1A_toOnly.verified_hours === 4.0 &&
        opp1A_toOnly.total_volunteers === 1 &&
        opp1B_toOnly.total_hours === 0 &&
        opp1B_toOnly.total_volunteers === 0,
      `Test 12: to_date only (<= 2026-09-30) includes only records up to end of that date`
    );

    // Test 13: Both from_date and to_date (October 2026: 2026-10-01 to 2026-10-31)
    // Opp 1A has Oct 15 (2.0 RECORDED) -> 2.0 hours, 1 volunteer (Alice)
    // Opp 1B has Oct 10 (5.0 VERIFIED) -> 5.0 hours, 1 volunteer (Alice)
    const bothRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-10-01&to_date=2026-10-31`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    const bothData = await bothRes.json();
    const bothOpps = bothData.data?.opportunities || bothData.data?.opportunity_hours;
    const opp1A_both = bothOpps?.find((o) => o.opportunity_id === opp1AId);
    const opp1B_both = bothOpps?.find((o) => o.opportunity_id === opp1BId);

    assert(
      bothRes.status === 200 &&
        opp1A_both.total_hours === 2.0 &&
        opp1A_both.recorded_hours === 2.0 &&
        opp1A_both.verified_hours === 0 &&
        opp1A_both.pending_hours === 0 &&
        opp1A_both.total_volunteers === 1 &&
        opp1B_both.total_hours === 5.0 &&
        opp1B_both.verified_hours === 5.0,
      `Test 13: Both from_date and to_date (October) includes strictly October records (Opp 1A: 2.0h, Opp 1B: 5.0h)`
    );

    // Test 14: LEFT JOIN preservation: Opportunities with NO matching hours in range still appear with zeros
    const opp1C_both = bothOpps?.find((o) => o.opportunity_id === opp1CId);
    assert(
      opp1C_both &&
        opp1C_both.total_volunteers === 0 &&
        opp1C_both.total_hours === 0 &&
        opp1C_both.verified_hours === 0 &&
        opp1C_both.recorded_hours === 0 &&
        opp1C_both.pending_hours === 0 &&
        opp1B_toOnly &&
        opp1B_toOnly.total_hours === 0,
      'Test 14: Opportunities with zero matching hours in range still appear with zero metric values'
    );

    // ================================================================
    // Group 5: Boundary Dates & Single-Day Filtering
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Boundary Dates & Single-Day Filtering${colors.reset}`);

    // Test 15: Exact single-day match (from_date = to_date = 2026-09-05)
    // Rec 1 was created on 2026-09-05T10:00:00Z -> should be included!
    const singleDayRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-09-05&to_date=2026-09-05`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    const singleDayData = await singleDayRes.json();
    const singleDayOpps = singleDayData.data?.opportunities || singleDayData.data?.opportunity_hours;
    const opp1A_singleDay = singleDayOpps?.find((o) => o.opportunity_id === opp1AId);

    assert(
      singleDayRes.status === 200 &&
        opp1A_singleDay.total_hours === 4.0 &&
        opp1A_singleDay.verified_hours === 4.0 &&
        opp1A_singleDay.total_volunteers === 1,
      `Test 15: Exact single-day filter (2026-09-05 to 2026-09-05) includes records created on that day`
    );

    // Test 16: Adjacent day boundary: 2026-09-06 to 2026-09-06 excludes 2026-09-05
    const adjDayRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-09-06&to_date=2026-09-06`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    const adjDayData = await adjDayRes.json();
    const adjDayOpps = adjDayData.data?.opportunities || adjDayData.data?.opportunity_hours;
    const opp1A_adjDay = adjDayOpps?.find((o) => o.opportunity_id === opp1AId);

    assert(
      adjDayRes.status === 200 && opp1A_adjDay.total_hours === 0 && opp1A_adjDay.total_volunteers === 0,
      `Test 16: Adjacent day boundary correctly excludes previous day record`
    );

    // ================================================================
    // Group 6: Multi-Tenant Isolation & Security
    // ================================================================
    console.log(`\n${colors.bold}Group 6: Multi-Tenant Isolation & Security${colors.reset}`);

    // Test 17: Coordinator 1 cannot see Coordinator 2's opportunities with date filters
    const coord1HasCoord2Opp = bothOpps.some((o) => o.opportunity_id === opp2AId);
    assert(
      !coord1HasCoord2Opp,
      "Test 17: Ownership isolation: Coordinator 1 cannot see Coordinator 2's opportunity"
    );

    // Test 18: Coordinator 2 retrieves only their opportunity with date filters
    const coord2Res = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-09-01&to_date=2026-09-30`,
      {
        headers: { Authorization: `Bearer ${tokenCoord2}` },
      }
    );
    const coord2Data = await coord2Res.json();
    const oppList2 = coord2Data.data?.opportunities || coord2Data.data?.opportunity_hours;
    const opp2A_res = oppList2?.find((o) => o.opportunity_id === opp2AId);

    assert(
      coord2Res.status === 200 &&
        oppList2.length === 1 &&
        opp2A_res.total_hours === 3.0 &&
        opp2A_res.total_volunteers === 1,
      `Test 18: Coordinator 2 strictly retrieves only their opportunity with date filters`
    );

    // Test 19: Sensitive fields are NOT exposed
    const rawResBody = JSON.stringify(bothData);
    assert(
      !rawResBody.includes('password') && !rawResBody.includes('password_hash'),
      'Test 19: Response does NOT leak password or password_hash'
    );

    // ================================================================
    // Group 7: Regression of Existing Functionality (Days 20-24)
    // ================================================================
    console.log(`\n${colors.bold}Group 7: Regression of Existing Functionality (Days 20-24)${colors.reset}`);

    // Test 20: Day 20 POST /api/signups/:id/hours remains operational (201 Created)
    const regRecordRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 1.5, status: 'RECORDED' }),
    });
    const regRecordData = await regRecordRes.json();
    const regHourId = regRecordData.data?.volunteer_hours?.id;
    assert(
      regRecordRes.status === 201 && regHourId !== undefined,
      'Test 20: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 21: Day 21 GET /api/hours/my remains operational (200 OK)
    const regMyRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const regMyData = await regMyRes.json();
    const regMyList = regMyData.data?.volunteer_hours || regMyData.data?.hours;
    assert(
      regMyRes.status === 200 && Array.isArray(regMyList) && regMyList.length >= 3,
      'Test 21: Day 21 GET /api/hours/my remains operational (200 OK)'
    );

    // Test 22: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)
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
      'Test 22: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 23: Day 23 GET /api/hours/my/summary remains operational (200 OK)
    const regMySummaryRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    const regMySummaryData = await regMySummaryRes.json();
    const regMySum = regMySummaryData.data?.summary || regMySummaryData.data;
    assert(
      regMySummaryRes.status === 200 && typeof regMySum?.total_hours === 'number',
      'Test 23: Day 23 GET /api/hours/my/summary remains operational (200 OK)'
    );

    // Test 24: Day 24 GET /api/hours/organization/opportunities works without date filters
    const regDay24Res = await fetch(`${baseUrl}/api/hours/organization/opportunities`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    const regDay24Data = await regDay24Res.json();
    const regDay24List = regDay24Data.data?.opportunities || regDay24Data.data?.opportunity_hours;
    assert(
      regDay24Res.status === 200 && Array.isArray(regDay24List) && regDay24List.length === 3,
      'Test 24: Day 24 GET /api/hours/organization/opportunities remains fully operational without filters'
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
  console.log(`  DAY 25 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
