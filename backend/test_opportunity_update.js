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
  console.log(`  DAY 29: COORDINATOR OPPORTUNITY UPDATE TEST SUITE          `);
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
    full_name: 'Coordinator One Day 29',
    email: `coord1.opp.update.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Coordinator Two Day 29',
    email: `coord2.opp.update.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Volunteer Alice Day 29',
    email: `vol1.opp.update.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Volunteer Bob Day 29',
    email: `vol2.opp.update.${timestamp}@test.org`,
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

    const userCoord1 = userCoord1Data.data.user;
    const userCoord2 = userCoord2Data.data.user;
    const userVol1 = userVol1Data.data.user;
    const userVol2 = userVol2Data.data.user;

    const tokenCoord1 = (await loginUser(coordinator1.email, coordinator1.password)).data.token;
    const tokenCoord2 = (await loginUser(coordinator2.email, coordinator2.password)).data.token;
    const tokenVol1 = (await loginUser(volunteer1.email, volunteer1.password)).data.token;
    const tokenVol2 = (await loginUser(volunteer2.email, volunteer2.password)).data.token;

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

    const org1Id = await createOrg(`Org One OppUpdate ${timestamp}`, tokenCoord1);
    const org2Id = await createOrg(`Org Two OppUpdate ${timestamp}`, tokenCoord2);

    // Helper: create opportunity
    const createOpp = async (orgId, title, capacity, status, token) => {
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
          start_time: '10:00:00',
          end_time: '14:00:00',
          location: 'Civic Center',
          address: '100 Main St',
          capacity,
          status,
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    // Opp 1A: Draft opportunity under Coord 1
    const opp1A_Id = await createOpp(org1Id, 'Initial Cleanup Event', 10, 'DRAFT', tokenCoord1);
    // Opp 1B: Published opportunity for capacity testing under Coord 1
    const opp1B_Id = await createOpp(org1Id, 'Park Tree Planting', 5, 'PUBLISHED', tokenCoord1);
    // Opp 2: Opp under Coord 2
    const opp2_Id = await createOpp(org2Id, 'Coord 2 Opportunity', 5, 'PUBLISHED', tokenCoord2);

    console.log(`${colors.yellow}Test entities prepared successfully.${colors.reset}\n`);

    // ================================================================
    // Group 1: Authentication & Authorization Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Authentication & Authorization Controls${colors.reset}`);

    // Test 1: Unauthenticated request returns 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    assert(
      unauthRes.status === 401,
      'Test 1: Unauthenticated request returns 401 Unauthorized'
    );

    // Test 2: Invalid JWT returns 401 Unauthorized
    const invalidTokenRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token',
      },
      body: JSON.stringify({ title: 'New Title' }),
    });
    assert(
      invalidTokenRes.status === 401,
      'Test 2: Invalid JWT returns 401 Unauthorized'
    );

    // Test 3: Volunteer accessing PATCH /api/opportunities/:id returns 403 Forbidden
    const volRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
      body: JSON.stringify({ title: 'Volunteer Attempt' }),
    });
    assert(
      volRes.status === 403,
      'Test 3: Volunteer accessing coordinator update endpoint returns 403 Forbidden'
    );

    // Test 4: Invalid opportunity UUID format returns 400 Bad Request
    const invalidUuidRes = await fetch(`${baseUrl}/api/opportunities/not-a-valid-uuid`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ title: 'Valid Title' }),
    });
    const invalidUuidData = await invalidUuidRes.json();
    assert(
      invalidUuidRes.status === 400 && invalidUuidData.message.includes('valid UUID'),
      'Test 4: Invalid opportunity UUID format returns 400 Bad Request'
    );

    // Test 5: Non-existent opportunity UUID returns 404 Not Found
    const nonExistentUuid = 'a0000000-0000-0000-0000-000000000000';
    const nonExistentRes = await fetch(`${baseUrl}/api/opportunities/${nonExistentUuid}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ title: 'Valid Title' }),
    });
    const nonExistentData = await nonExistentRes.json();
    assert(
      nonExistentRes.status === 404 && nonExistentData.message.includes('Opportunity not found'),
      'Test 5: Non-existent opportunity UUID returns 404 Not Found'
    );

    // Test 6: Coordinator 1 cannot update Coordinator 2's opportunity (403 Forbidden)
    const crossCoordRes1 = await fetch(`${baseUrl}/api/opportunities/${opp2_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ title: 'Hijack Attempt' }),
    });
    const crossCoordData1 = await crossCoordRes1.json();
    assert(
      crossCoordRes1.status === 403 && crossCoordData1.message.includes('permission'),
      'Test 6: Coordinator 1 cannot update Coordinator 2 opportunity (403 Forbidden)'
    );

    // Test 7: Coordinator 2 cannot update Coordinator 1's opportunity (403 Forbidden)
    const crossCoordRes2 = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({ title: 'Hijack Attempt 2' }),
    });
    assert(
      crossCoordRes2.status === 403,
      'Test 7: Coordinator 2 cannot update Coordinator 1 opportunity (403 Forbidden)'
    );

    // ================================================================
    // Group 2: Field Validations (400 Bad Request)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Input Field Validations${colors.reset}`);

    // Test 8: Empty / short title (< 2 chars) returns 400 Bad Request
    const shortTitleRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ title: 'A' }),
    });
    assert(
      shortTitleRes.status === 400,
      'Test 8: Title under 2 characters rejected with 400 Bad Request'
    );

    // Test 9: Overly long title (> 255 chars) returns 400 Bad Request
    const longTitleRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ title: 'X'.repeat(256) }),
    });
    assert(
      longTitleRes.status === 400,
      'Test 9: Title exceeding 255 characters rejected with 400 Bad Request'
    );

    // Test 10: Invalid date format returns 400 Bad Request
    const invalidDateRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ event_date: '11-20-2026' }),
    });
    assert(
      invalidDateRes.status === 400,
      'Test 10: Invalid date format (MM-DD-YYYY) rejected with 400 Bad Request'
    );

    // Test 11: Impossible calendar date (2026-02-30) returns 400 Bad Request
    const impossibleDateRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ event_date: '2026-02-30' }),
    });
    assert(
      impossibleDateRes.status === 400,
      'Test 11: Impossible calendar date 2026-02-30 rejected with 400 Bad Request'
    );

    // Test 12: Invalid non-leap Feb 29 (2026-02-29) returns 400 Bad Request
    const nonLeapDateRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ event_date: '2026-02-29' }),
    });
    assert(
      nonLeapDateRes.status === 400,
      'Test 12: Non-leap year Feb 29 (2026-02-29) rejected with 400 Bad Request'
    );

    // Test 13: End time earlier than start time (both provided) returns 400 Bad Request
    const invalidTimeRangeRes1 = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ start_time: '14:00:00', end_time: '10:00:00' }),
    });
    const invalidTimeRangeData1 = await invalidTimeRangeRes1.json();
    assert(
      invalidTimeRangeRes1.status === 400 &&
        invalidTimeRangeData1.message.includes('not be earlier than start time'),
      'Test 13: End time earlier than start time rejected with 400 Bad Request'
    );

    // Test 14: End time earlier than existing start time (only end_time provided: opp1A start_time is 10:00:00)
    const invalidTimeRangeRes2 = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ end_time: '09:00:00' }),
    });
    assert(
      invalidTimeRangeRes2.status === 400,
      'Test 14: Partial update with end_time earlier than existing start_time rejected with 400 Bad Request'
    );

    // Test 15: Invalid capacity (0, negative, non-integer) returns 400 Bad Request
    const invalidCapRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ capacity: 0 }),
    });
    assert(
      invalidCapRes.status === 400,
      'Test 15: Capacity = 0 rejected with 400 Bad Request (must be positive integer)'
    );

    // Test 16: Invalid status returns 400 Bad Request
    const invalidStatusRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    });
    const invalidStatusData = await invalidStatusRes.json();
    assert(
      invalidStatusRes.status === 400 && invalidStatusData.message.includes('DRAFT, PUBLISHED'),
      'Test 16: Invalid status rejected with 400 Bad Request'
    );

    // ================================================================
    // Group 3: Successful Update & Partial Update Semantics
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Successful Update & Partial Update Semantics${colors.reset}`);

    // Pre-read Opp 1A from database
    const preDbOpp = (await pool.query(`SELECT * FROM opportunities WHERE id = $1`, [opp1A_Id])).rows[0];

    // Test 17: Coordinator successfully updates own opportunity (title, description, status)
    const validUpdateRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        title: 'Updated Tree Planting Gala',
        description: 'New gala description',
        status: 'PUBLISHED',
      }),
    });
    const validUpdateData = await validUpdateRes.json();
    assert(
      validUpdateRes.status === 200 &&
        validUpdateData.status === 'success' &&
        validUpdateData.data?.opportunity?.title === 'Updated Tree Planting Gala' &&
        validUpdateData.data?.opportunity?.status === 'PUBLISHED',
      'Test 17: Coordinator successfully updates own opportunity (200 OK)'
    );

    // Test 18: Partial update modifies only supplied fields; unspecified fields remain untouched
    const updatedOpp = validUpdateData.data?.opportunity;
    assert(
      updatedOpp.category === preDbOpp.category &&
        updatedOpp.location === preDbOpp.location &&
        updatedOpp.capacity === preDbOpp.capacity &&
        updatedOpp.address === preDbOpp.address,
      'Test 18: Unspecified fields (category, location, capacity, address) remain strictly unchanged'
    );

    // Test 19: Valid leap year date 2024-02-29 is accepted
    const leapDateRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ event_date: '2024-02-29' }),
    });
    const leapDateData = await leapDateRes.json();
    const leapDb = (await pool.query(`SELECT event_date::text FROM opportunities WHERE id = $1`, [opp1A_Id])).rows[0];
    assert(
      leapDateRes.status === 200 &&
        leapDateData.status === 'success' &&
        leapDb.event_date === '2024-02-29',
      'Test 19: Valid leap-year date (2024-02-29) is accepted and updated'
    );

    // Test 20: Status normalization (lowercase 'published' normalized to 'PUBLISHED')
    const lowerStatusRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'published' }),
    });
    const lowerStatusData = await lowerStatusRes.json();
    assert(
      lowerStatusRes.status === 200 &&
        lowerStatusData.data?.opportunity?.status === 'PUBLISHED',
      'Test 20: Lowercase status "published" is normalized to "PUBLISHED"'
    );

    // Test 21: Database confirms updated_at was refreshed, id/orgId/created_at remain unchanged
    const postDbOpp = (await pool.query(`SELECT * FROM opportunities WHERE id = $1`, [opp1A_Id])).rows[0];
    assert(
      postDbOpp.id === preDbOpp.id &&
        postDbOpp.organization_id === preDbOpp.organization_id &&
        new Date(postDbOpp.created_at).getTime() === new Date(preDbOpp.created_at).getTime() &&
        new Date(postDbOpp.updated_at).getTime() >= new Date(preDbOpp.updated_at).getTime(),
      'Test 21: Database confirms updated_at updated; id, organization_id, and created_at immutable'
    );

    // ================================================================
    // Group 4: Anti-Spoofing & Immutability of Ownership
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Anti-Spoofing & Immutability of Ownership${colors.reset}`);

    // Test 22: organization_id cannot be changed through request body
    const spoofOrgRes = await fetch(`${baseUrl}/api/opportunities/${opp1A_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        title: 'Title Change With Org Spoof',
        organization_id: org2Id, // Attempt to reassign to Org 2
      }),
    });
    const spoofOrgData = await spoofOrgRes.json();
    assert(
      spoofOrgRes.status === 200 &&
        spoofOrgData.data?.opportunity?.organization_id === org1Id,
      'Test 22: organization_id in body is ignored; opportunity ownership cannot be modified'
    );

    // Test 23: coordinator_id cannot be used to bypass ownership
    const spoofCoordRes = await fetch(
      `${baseUrl}/api/opportunities/${opp2_Id}?coordinator_id=${userCoord2.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCoord1}`, // Coord 1 attempts to modify Coord 2's opp by passing Coord 2 id
        },
        body: JSON.stringify({
          title: 'Unauthorized Spoofed Title',
          coordinator_id: userCoord2.id,
        }),
      }
    );
    assert(
      spoofCoordRes.status === 403,
      'Test 23: Client-supplied coordinator_id cannot bypass ownership (strictly uses JWT identity)'
    );

    // ================================================================
    // Group 5: Capacity Safety & Interaction with Signups (409 Conflict)
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Capacity Safety & Interaction with Signups${colors.reset}`);

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

    // Test 24: Volunteer 1 and Volunteer 2 sign up for Opp 1B (initial capacity = 5)
    const signup1B_Alice = await signupVolunteer(opp1B_Id, tokenVol1);
    const signup1B_Bob = await signupVolunteer(opp1B_Id, tokenVol2);
    assert(
      signup1B_Alice !== undefined && signup1B_Bob !== undefined,
      'Test 24: Two volunteers sign up for Opp 1B (currently 2 active signups, capacity 5)'
    );

    // Test 25: Reducing capacity below active signup count (new capacity = 1 < 2 active) is rejected with 409 Conflict
    const reduceCapFailRes = await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ capacity: 1 }),
    });
    const reduceCapFailData = await reduceCapFailRes.json();
    assert(
      reduceCapFailRes.status === 409 &&
        reduceCapFailData.message.includes('active signups'),
      'Test 25: Reducing capacity below active signup count rejected with 409 Conflict'
    );

    // Test 26: Reducing capacity to exactly the active signup count (new capacity = 2 == 2 active) succeeds (200 OK)
    const reduceCapExactRes = await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ capacity: 2 }),
    });
    const reduceCapExactData = await reduceCapExactRes.json();
    assert(
      reduceCapExactRes.status === 200 &&
        reduceCapExactData.data?.opportunity?.capacity === 2,
      'Test 26: Reducing capacity to exactly the active signup count succeeds (200 OK)'
    );

    // Test 27: One volunteer cancels signup -> active signups become 1; CANCELLED signups excluded from active count
    const cancelBobRes = await fetch(`${baseUrl}/api/signups/${signup1B_Bob}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol2}`,
      },
    });
    assert(
      cancelBobRes.status === 200,
      'Test 27: Bob cancels his signup; CANCELLED signup is excluded from active capacity calculation'
    );

    // Test 28: Coordinator can now safely reduce capacity to 1 (active count is now 1)
    const reduceCapPostCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ capacity: 1 }),
    });
    const reduceCapPostCancelData = await reduceCapPostCancelRes.json();
    assert(
      reduceCapPostCancelRes.status === 200 &&
        reduceCapPostCancelData.data?.opportunity?.capacity === 1,
      'Test 28: Capacity safely reduced to 1 after volunteer cancellation (200 OK)'
    );

    // ================================================================
    // Group 6: Regression & Non-Breakage of Days 17-28 Endpoints
    // ================================================================
    console.log(`\n${colors.bold}Group 6: Regression & Non-Breakage of Existing Endpoints${colors.reset}`);

    // Test 29: Existing GET /api/opportunities and GET /api/opportunities/:id still work
    const getOppRes = await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      getOppRes.status === 200,
      'Test 29: Existing GET /api/opportunities/:id remains fully operational (200 OK)'
    );

    // Test 30: Existing signup creation behavior still works
    // Increase capacity back to 2, Bob re-signs up? Or new volunteer signs up
    await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ capacity: 5 }),
    });

    const getAttendeesRes = await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}/signups`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      getAttendeesRes.status === 200,
      'Test 30: Existing GET /api/opportunities/:id/signups remains fully operational (200 OK)'
    );

    // Test 31: Day 27 PATCH /api/signups/:id/status remains operational
    const signupStatusRes = await fetch(`${baseUrl}/api/signups/${signup1B_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      signupStatusRes.status === 200,
      'Test 31: Day 27 coordinator signup status update remains operational (200 OK)'
    );

    // Test 32: Day 28 GET /api/signups/:id detail retrieval remains operational for coordinator
    const signupDetailRes = await fetch(`${baseUrl}/api/signups/${signup1B_Alice}`, {
      headers: { Authorization: `Bearer ${tokenCoord1}` },
    });
    assert(
      signupDetailRes.status === 200,
      'Test 32: Day 28 coordinator signup detail retrieval remains operational (200 OK)'
    );

    // Test 33: Volunteer hours regression (Day 20 & Day 21)
    // Reactivate Alice signup
    await fetch(`${baseUrl}/api/signups/${signup1B_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });

    const recordHourRes = await fetch(`${baseUrl}/api/signups/${signup1B_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 2.0, status: 'RECORDED' }),
    });
    assert(
      recordHourRes.status === 201,
      'Test 33: Day 20 record hours remains operational (201 Created)'
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
  console.log(`  DAY 29 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
