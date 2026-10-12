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
  console.log(`  VOLUNTEER HOURS IDEMPOTENCY SPECIFICATION TEST SUITE       `);
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
    full_name: 'Idempotency Coordinator Alpha',
    email: `coord1.idem.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Idempotency Coordinator Beta',
    email: `coord2.idem.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Idempotency Volunteer Alice',
    email: `vol1.idem.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Idempotency Volunteer Bob',
    email: `vol2.idem.${timestamp}@test.org`,
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
    await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [testEmails]);
  };

  let tokenCoord1;
  let tokenCoord2;
  let tokenVol1;
  let tokenVol2;

  let coord1Id;
  let coord2Id;
  let vol1Id;
  let vol2Id;

  let signup1Id;
  let signup2Id;
  let coord2SignupId;

  try {
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

    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(volunteer1);
    await registerUser(volunteer2);

    const coord1Login = await loginUser(coordinator1.email, coordinator1.password);
    tokenCoord1 = coord1Login.data.token;
    coord1Id = coord1Login.data.user.id;

    const coord2Login = await loginUser(coordinator2.email, coordinator2.password);
    tokenCoord2 = coord2Login.data.token;
    coord2Id = coord2Login.data.user.id;

    const vol1Login = await loginUser(volunteer1.email, volunteer1.password);
    tokenVol1 = vol1Login.data.token;
    vol1Id = vol1Login.data.user.id;

    const vol2Login = await loginUser(volunteer2.email, volunteer2.password);
    tokenVol2 = vol2Login.data.token;
    vol2Id = vol2Login.data.user.id;

    // Create Organization 1 for Coordinator 1
    const org1Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: 'Community Relief Org',
        description: 'Org 1 for idempotency tests',
      }),
    });
    const org1Data = await org1Res.json();
    const org1Id = org1Data.data.organization.id;

    // Create Organization 2 for Coordinator 2
    const org2Res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        name: 'Eco Preservation Org',
        description: 'Org 2 for idempotency tests',
      }),
    });
    const org2Data = await org2Res.json();
    const org2Id = org2Data.data.organization.id;

    // Create Opportunity 1 under Org 1
    const opp1Res = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        organization_id: org1Id,
        title: 'Community Food Drive',
        description: 'Sorting food donations',
        category: 'Food Security',
        event_date: '2026-11-20',
        start_time: '09:00:00',
        end_time: '14:00:00',
        location: 'Downtown Center',
        address: '100 Main St',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    const opp1Data = await opp1Res.json();
    const opp1Id = opp1Data.data.opportunity.id;

    // Create Opportunity 2 under Org 2
    const opp2Res = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
      },
      body: JSON.stringify({
        organization_id: org2Id,
        title: 'Wetland Restoration',
        description: 'Planting native reeds',
        category: 'Environment',
        event_date: '2026-11-22',
        start_time: '10:00:00',
        end_time: '15:00:00',
        location: 'Wetland Park',
        address: '200 River Rd',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    const opp2Data = await opp2Res.json();
    const opp2Id = opp2Data.data.opportunity.id;

    // Volunteer 1 signs up for Opportunity 1
    const s1Res = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const s1Data = await s1Res.json();
    signup1Id = s1Data.data.signup.id;

    // Volunteer 2 signs up for Opportunity 1
    const s2Res = await fetch(`${baseUrl}/api/opportunities/${opp1Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol2}`,
      },
    });
    const s2Data = await s2Res.json();
    signup2Id = s2Data.data.signup.id;

    // Volunteer 1 signs up for Opportunity 2 (owned by Coordinator 2)
    const s3Res = await fetch(`${baseUrl}/api/opportunities/${opp2Id}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const s3Data = await s3Res.json();
    coord2SignupId = s3Data.data.signup.id;

    console.log(`${colors.yellow}Test entities initialized successfully.${colors.reset}\n`);

    // ================================================================
    // Group 1: Header Validation Controls
    // ================================================================
    console.log(`${colors.bold}Group 1: Header Validation Controls${colors.reset}`);

    // Test 1: Empty Idempotency-Key header returns 400 Bad Request
    const emptyKeyRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': '   ',
      },
      body: JSON.stringify({ hours: 4.0 }),
    });
    assert(
      emptyKeyRes.status === 400,
      'Test 1: Empty or whitespace-only Idempotency-Key header rejected with 400 Bad Request'
    );

    // Test 2: Idempotency-Key exceeding 255 characters returns 400 Bad Request
    const longKey = 'k'.repeat(256);
    const longKeyRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': longKey,
      },
      body: JSON.stringify({ hours: 4.0 }),
    });
    assert(
      longKeyRes.status === 400,
      'Test 2: Idempotency-Key header exceeding 255 characters rejected with 400 Bad Request'
    );

    // ================================================================
    // Group 2: Backward Compatibility (Omitting Header)
    // ================================================================
    console.log(`\n${colors.bold}Group 2: Backward Compatibility (Absence of Header)${colors.reset}`);

    // Test 3 (Requirement A): Request without Idempotency-Key preserves existing behavior
    const noKeyRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 2.5, status: 'RECORDED' }),
    });
    const noKeyData = await noKeyRes.json();
    assert(
      noKeyRes.status === 201 &&
        noKeyData.status === 'success' &&
        parseFloat(noKeyData.data?.volunteer_hours?.hours) === 2.5,
      'Test 3 (A): Request without Idempotency-Key succeeds with 201 Created'
    );

    // Verify row in database has idempotency_key IS NULL
    const noKeyDb = await pool.query(
      `SELECT * FROM volunteer_hours WHERE id = $1`,
      [noKeyData.data?.volunteer_hours?.id]
    );
    assert(
      noKeyDb.rows.length === 1 && noKeyDb.rows[0].idempotency_key === null,
      'Test 3b: Stored database row has idempotency_key = NULL when header is omitted'
    );

    // ================================================================
    // Group 3: Core Idempotency (First Request & Safe Replay)
    // ================================================================
    console.log(`\n${colors.bold}Group 3: Core Idempotency (First Request & Safe Replay)${colors.reset}`);

    const key1 = `test-key-alpha-${timestamp}`;

    // Test 4 (Requirement B): First request with a key creates a record (201 Created)
    const firstReqRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': key1,
      },
      body: JSON.stringify({ hours: 4.5, status: 'RECORDED' }),
    });
    const firstReqData = await firstReqRes.json();
    const createdRecordId = firstReqData.data?.volunteer_hours?.id;

    assert(
      firstReqRes.status === 201 &&
        firstReqData.status === 'success' &&
        createdRecordId !== undefined,
      'Test 4 (B): First request with valid Idempotency-Key creates record with 201 Created'
    );

    // Test 5 (Requirement C): Repeating identical key and payload returns same record ID and 200 OK
    const retryReqRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': key1,
      },
      body: JSON.stringify({ hours: 4.5, status: 'RECORDED' }),
    });
    const retryReqData = await retryReqRes.json();
    const replayedRecordId = retryReqData.data?.volunteer_hours?.id;
    const isReplayedHeader = retryReqRes.headers.get('idempotency-replayed');

    assert(
      retryReqRes.status === 200 &&
        replayedRecordId === createdRecordId &&
        isReplayedHeader === 'true',
      `Test 5 (C): Replaying same key returns existing record ID (${createdRecordId}) with 200 OK and Idempotency-Replayed header`
    );

    // Verify database row count for this key is exactly 1
    const countDbKey1 = await pool.query(
      `SELECT COUNT(*)::int AS count FROM volunteer_hours WHERE recorded_by = $1 AND idempotency_key = $2`,
      [coord1Id, key1]
    );
    assert(
      countDbKey1.rows[0].count === 1,
      'Test 5b: Direct database count confirms exactly 1 row persisted for key1'
    );

    // ================================================================
    // Group 4: Payload Mismatch Conflict Detection (409 Conflict)
    // ================================================================
    console.log(`\n${colors.bold}Group 4: Payload Mismatch Conflict Detection (409 Conflict)${colors.reset}`);

    // Test 6 (Requirement D1): Same key reused with different signupId returns 409 Conflict
    const diffSignupRes = await fetch(`${baseUrl}/api/signups/${signup2Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': key1,
      },
      body: JSON.stringify({ hours: 4.5, status: 'RECORDED' }),
    });
    assert(
      diffSignupRes.status === 409,
      'Test 6 (D1): Reusing key with different signupId rejected with 409 Conflict'
    );

    // Test 7 (Requirement D2): Same key reused with different hours returns 409 Conflict
    const diffHoursRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': key1,
      },
      body: JSON.stringify({ hours: 6.0, status: 'RECORDED' }),
    });
    assert(
      diffHoursRes.status === 409,
      'Test 7 (D2): Reusing key with different hours value rejected with 409 Conflict'
    );

    // Test 8 (Requirement D3): Same key reused with different status returns 409 Conflict
    const diffStatusRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': key1,
      },
      body: JSON.stringify({ hours: 4.5, status: 'VERIFIED' }),
    });
    assert(
      diffStatusRes.status === 409,
      'Test 8 (D3): Reusing key with different status rejected with 409 Conflict'
    );

    // ================================================================
    // Group 5: Multi-Tenant Key Isolation & Multi-Record Support
    // ================================================================
    console.log(`\n${colors.bold}Group 5: Multi-Tenant Isolation & Multiple Records Support${colors.reset}`);

    // Test 9 (Requirement E): Coordinator 2 using the same key does not collide with Coordinator 1
    const coord2SameKeyRes = await fetch(`${baseUrl}/api/signups/${coord2SignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
        'Idempotency-Key': key1, // Same key string as Coordinator 1!
      },
      body: JSON.stringify({ hours: 3.0, status: 'RECORDED' }),
    });
    const coord2SameKeyData = await coord2SameKeyRes.json();
    assert(
      coord2SameKeyRes.status === 201 &&
        coord2SameKeyData.data?.volunteer_hours?.recorded_by === coord2Id &&
        coord2SameKeyData.data?.volunteer_hours?.id !== createdRecordId,
      'Test 9 (E): Different coordinators do not collide when using the same key string (Multi-tenant scoped)'
    );

    // Test 10 (Requirement F): Distinct keys allow multiple legitimate records on same signup
    const key2 = `test-key-beta-${timestamp}`;
    const secondLegitRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': key2,
      },
      body: JSON.stringify({ hours: 3.5, status: 'VERIFIED' }),
    });
    const secondLegitData = await secondLegitRes.json();
    assert(
      secondLegitRes.status === 201 &&
        secondLegitData.data?.volunteer_hours?.id !== createdRecordId &&
        parseFloat(secondLegitData.data?.volunteer_hours?.hours) === 3.5,
      'Test 10 (F): Distinct idempotency keys allow multiple legitimate hours records on the same signup'
    );

    // ================================================================
    // Group 6: Concurrency Safety & Race Condition Resolution
    // ================================================================
    console.log(`\n${colors.bold}Group 6: Concurrency Safety & Race Condition Resolution${colors.reset}`);

    // Test 11 (Requirement G): Concurrent identical requests using Promise.all create exactly one row
    const concurrentKey = `test-concurrent-key-${timestamp}`;
    const concurrentPayload = JSON.stringify({ hours: 5.0, status: 'RECORDED' });

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/signups/${signup2Id}/hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCoord1}`,
          'Idempotency-Key': concurrentKey,
        },
        body: concurrentPayload,
      }),
      fetch(`${baseUrl}/api/signups/${signup2Id}/hours`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCoord1}`,
          'Idempotency-Key': concurrentKey,
        },
        body: concurrentPayload,
      }),
    ]);

    const dataA = await resA.json();
    const dataB = await resB.json();

    const statuses = [resA.status, resB.status].sort();
    const idA = dataA.data?.volunteer_hours?.id;
    const idB = dataB.data?.volunteer_hours?.id;

    const bothSucceeded = (statuses[0] === 200 || statuses[0] === 201) &&
                          (statuses[1] === 200 || statuses[1] === 201);
    const identicalIds = idA !== undefined && idA === idB;

    assert(
      bothSucceeded && identicalIds,
      `Test 11 (G): Concurrent identical requests safely resolved with matching record IDs (ID: ${idA})`
    );

    // Verify database row count for concurrent key is strictly 1
    const countConcurrentDb = await pool.query(
      `SELECT COUNT(*)::int AS count FROM volunteer_hours WHERE recorded_by = $1 AND idempotency_key = $2`,
      [coord1Id, concurrentKey]
    );
    assert(
      countConcurrentDb.rows[0].count === 1,
      'Test 11b: Database verification confirms exactly 1 row persisted for concurrent key'
    );

    // ================================================================
    // Group 7: Error Isolation & Clean Rollback State
    // ================================================================
    console.log(`\n${colors.bold}Group 7: Error Isolation & Incomplete State Prevention${colors.reset}`);

    // Test 12 (Requirement H): Failed requests do not leave incomplete idempotency state
    const failedKey = `test-failed-key-${timestamp}`;

    // Coordinator 2 attempts to record hours for Coordinator 1's signup (403 Forbidden)
    const crossCoordForbiddenRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
        'Idempotency-Key': failedKey,
      },
      body: JSON.stringify({ hours: 4.0 }),
    });
    assert(
      crossCoordForbiddenRes.status === 403,
      'Test 12 (H1): Unauthorized request returns 403 Forbidden'
    );

    // Verify database has 0 rows for failedKey
    const checkDbFailed = await pool.query(
      `SELECT COUNT(*)::int AS count FROM volunteer_hours WHERE idempotency_key = $1`,
      [failedKey]
    );
    assert(
      checkDbFailed.rows[0].count === 0,
      'Test 12 (H2): Database query confirms no record was persisted for failed request'
    );

    // Coordinator 2 now uses the same failedKey for their own valid signup
    const retryAfterFailRes = await fetch(`${baseUrl}/api/signups/${coord2SignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord2}`,
        'Idempotency-Key': failedKey,
      },
      body: JSON.stringify({ hours: 4.0, status: 'RECORDED' }),
    });
    const retryAfterFailData = await retryAfterFailRes.json();
    assert(
      retryAfterFailRes.status === 201 &&
        retryAfterFailData.status === 'success' &&
        retryAfterFailData.data?.volunteer_hours?.id !== undefined,
      'Test 12 (H3): Key from previously failed request can be successfully used on a valid request'
    );

    // ================================================================
    // Group 8: Regression: Idempotency Replay After Status Mutation
    // ================================================================
    console.log(`\n${colors.bold}Group 8: Regression: Idempotency Replay After Status Mutation${colors.reset}`);

    const statusMutationKey = `test-status-mutation-${timestamp}`;
    const initialPayload = { hours: 3.5, status: 'RECORDED' };

    // 1. Create a keyed record with status RECORDED
    const createKeyedRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': statusMutationKey,
      },
      body: JSON.stringify(initialPayload),
    });
    const createKeyedData = await createKeyedRes.json();
    const mutatedRecordId = createKeyedData.data?.volunteer_hours?.id;

    assert(
      createKeyedRes.status === 201 &&
        createKeyedData.status === 'success' &&
        mutatedRecordId !== undefined,
      'Test 13 (Reg-1): Initial keyed record created with status RECORDED (201 Created)'
    );

    // 2. Update its status to VERIFIED through the existing status endpoint (PATCH /api/hours/:id/status)
    const patchStatusRes = await fetch(`${baseUrl}/api/hours/${mutatedRecordId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    const patchStatusData = await patchStatusRes.json();

    assert(
      patchStatusRes.status === 200 &&
        patchStatusData.data?.volunteer_hours?.status === 'VERIFIED',
      'Test 13 (Reg-2): Status updated to VERIFIED via PATCH /api/hours/:id/status (200 OK)'
    );

    // Verify row in database is indeed VERIFIED
    const dbStatusCheck = await pool.query(
      `SELECT status, payload_hash FROM volunteer_hours WHERE id = $1`,
      [mutatedRecordId]
    );
    assert(
      dbStatusCheck.rows.length === 1 &&
        dbStatusCheck.rows[0].status === 'VERIFIED' &&
        dbStatusCheck.rows[0].payload_hash !== null,
      'Test 13 (Reg-3): Database confirms row status is VERIFIED while payload_hash remains intact'
    );

    // 3. Replay the original request with the same key and original payload (RECORDED)
    const replayAfterMutationRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': statusMutationKey,
      },
      body: JSON.stringify(initialPayload),
    });
    const replayAfterMutationData = await replayAfterMutationRes.json();
    const replayRecordId = replayAfterMutationData.data?.volunteer_hours?.id;
    const replayedHeader = replayAfterMutationRes.headers.get('idempotency-replayed');

    assert(
      replayAfterMutationRes.status === 200 &&
        replayRecordId === mutatedRecordId &&
        replayedHeader === 'true',
      'Test 13 (Reg-4): Replaying original creation payload returns same record ID with 200 OK after status change'
    );

    // 4. Assert no additional row was created in the database
    const countMutationDb = await pool.query(
      `SELECT COUNT(*)::int AS count FROM volunteer_hours WHERE recorded_by = $1 AND idempotency_key = $2`,
      [coord1Id, statusMutationKey]
    );
    assert(
      countMutationDb.rows[0].count === 1,
      'Test 13 (Reg-5): Database row count confirms no additional row was inserted'
    );

    // 5. Reuse the same key with a genuinely different original payload (different hours) and confirm HTTP 409
    const diffPayloadRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': statusMutationKey,
      },
      body: JSON.stringify({ hours: 5.0, status: 'RECORDED' }),
    });
    assert(
      diffPayloadRes.status === 409,
      'Test 13 (Reg-6): Reusing mutated record key with different hours returns HTTP 409 Conflict'
    );

    // 6. Reuse the same key with genuinely different status from original request (PENDING) and confirm HTTP 409
    const diffStatusPayloadRes = await fetch(`${baseUrl}/api/signups/${signup1Id}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
        'Idempotency-Key': statusMutationKey,
      },
      body: JSON.stringify({ hours: 3.5, status: 'PENDING' }),
    });
    assert(
      diffStatusPayloadRes.status === 409,
      'Test 13 (Reg-7): Reusing mutated record key with different status than original request returns HTTP 409 Conflict'
    );

  } catch (error) {
    console.error('Unexpected test failure:', error);
    failed++;
  } finally {
    try {
      await cleanupDatabase();
    } catch (e) {
      // ignore cleanup errors
    }
    if (server) {
      server.close();
    }
    await pool.end();
  }

  console.log(`\n=============================================================`);
  console.log(`  IDEMPOTENCY TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
