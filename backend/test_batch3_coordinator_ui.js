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
  console.log(`  BATCH 3: COORDINATOR OPPORTUNITY MANAGEMENT TEST SUITE     `);
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
    full_name: 'Coordinator Alpha Batch3',
    email: `coord.alpha.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordB = {
    full_name: 'Coordinator Beta Batch3',
    email: `coord.beta.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer = {
    full_name: 'Volunteer Charlie Batch3',
    email: `vol.charlie.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const testEmails = [coordA.email, coordB.email, volunteer.email];

  const cleanupDatabase = async () => {
    try {
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
    await registerUser(coordA);
    await registerUser(coordB);
    await registerUser(volunteer);

    // Login test accounts
    const loginCoordA = await loginUser(coordA.email, coordA.password);
    const loginCoordB = await loginUser(coordB.email, coordB.password);
    const loginVol = await loginUser(volunteer.email, volunteer.password);

    const tokenCoordA = loginCoordA.data?.token;
    const tokenCoordB = loginCoordB.data?.token;
    const tokenVol = loginVol.data?.token;

    // Helper to create an organization
    const createOrg = async (token, name) => {
      const res = await fetch(`${baseUrl}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description: 'Test Org for Batch 3' }),
      });
      const data = await res.json();
      return data.data?.organization?.id;
    };

    const orgAId = await createOrg(tokenCoordA, 'Alpha Community Builders');
    const orgBId = await createOrg(tokenCoordB, 'Beta Conservation Trust');

    // =========================================================================
    // SECTION 1: AUTH & RBAC FOR MANAGED OPPORTUNITIES
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 1: Managed Opportunities Access Controls ---${colors.reset}`);

    // Test 1: Unauthenticated request to /api/opportunities?managed=true returns 401
    const unauthManagedRes = await fetch(`${baseUrl}/api/opportunities?managed=true`);
    assert(
      unauthManagedRes.status === 401,
      'Test 1: Unauthenticated GET /api/opportunities?managed=true returns 401 Unauthorized'
    );

    // Test 2: Volunteer accessing /api/opportunities?managed=true returns 403 Forbidden
    const volManagedRes = await fetch(`${baseUrl}/api/opportunities?managed=true`, {
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    assert(
      volManagedRes.status === 403,
      'Test 2: Volunteer access to GET /api/opportunities?managed=true rejected with 403 Forbidden'
    );

    // Test 3: Coordinator A with no opportunities receives empty array [] (200 OK)
    const coordAEmptyRes = await fetch(`${baseUrl}/api/opportunities?managed=true`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const coordAEmptyData = await coordAEmptyRes.json();
    assert(
      coordAEmptyRes.status === 200 &&
        Array.isArray(coordAEmptyData.data?.opportunities) &&
        coordAEmptyData.data.opportunities.length === 0,
      'Test 3: Coordinator with zero opportunities receives empty array [] with 200 OK'
    );

    // =========================================================================
    // SECTION 2: OPPORTUNITY CREATION VALIDATION & AUTHORIZATION
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 2: Opportunity Creation Validation & Ownership ---${colors.reset}`);

    const basePayload = {
      organization_id: orgAId,
      title: 'Riverbank Clean-up Action',
      description: 'Removing trash along the riverside trail.',
      category: 'Environment',
      event_date: '2027-05-20',
      start_time: '09:00',
      end_time: '12:00',
      location: 'Riverside North Park',
      address: '100 River Road',
      capacity: 15,
      status: 'PUBLISHED',
    };

    // Test 4: Unauthenticated creation returns 401
    const unauthCreateRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });
    assert(
      unauthCreateRes.status === 401,
      'Test 4: Unauthenticated POST /api/opportunities returns 401 Unauthorized'
    );

    // Test 5: Volunteer attempting creation returns 403 Forbidden
    const volCreateRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol}`,
      },
      body: JSON.stringify(basePayload),
    });
    assert(
      volCreateRes.status === 403,
      'Test 5: Volunteer attempting POST /api/opportunities returns 403 Forbidden'
    );

    // Test 6: Missing title returns 400 Bad Request
    const missingTitleRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, title: '' }),
    });
    assert(
      missingTitleRes.status === 400,
      'Test 6: Missing title on creation returns 400 Bad Request'
    );

    // Test 7: Title shorter than 2 characters returns 400
    const shortTitleRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, title: 'A' }),
    });
    assert(
      shortTitleRes.status === 400,
      'Test 7: Title under 2 characters returns 400 Bad Request'
    );

    // Test 8: Invalid event date returns 400
    const invalidDateRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, event_date: '2027-02-31' }),
    });
    assert(
      invalidDateRes.status === 400,
      'Test 8: Invalid calendar event_date returns 400 Bad Request'
    );

    // Test 9: End time earlier than start time returns 400
    const invalidTimeRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, start_time: '14:00', end_time: '11:00' }),
    });
    assert(
      invalidTimeRes.status === 400,
      'Test 9: End time earlier than start time returns 400 Bad Request'
    );

    // Test 10: Capacity <= 0 returns 400
    const invalidCapRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, capacity: 0 }),
    });
    assert(
      invalidCapRes.status === 400,
      'Test 10: Capacity <= 0 returns 400 Bad Request'
    );

    // Test 11: Invalid organization UUID returns 400
    const invalidOrgIdRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, organization_id: 'not-a-valid-uuid' }),
    });
    assert(
      invalidOrgIdRes.status === 400,
      'Test 11: Invalid organization UUID returns 400 Bad Request'
    );

    // Test 12: Coordinator A attempting to create opportunity under Coordinator B's organization returns 403
    const crossOrgCreateRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ ...basePayload, organization_id: orgBId }),
    });
    assert(
      crossOrgCreateRes.status === 403,
      'Test 12: Creating opportunity for organization owned by another coordinator returns 403 Forbidden'
    );

    // Test 13: Coordinator A successfully creates opportunity for own organization (201 Created)
    const validCreateRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify(basePayload),
    });
    const validCreateData = await validCreateRes.json();
    const createdOppId = validCreateData.data?.opportunity?.id;

    assert(
      validCreateRes.status === 201 &&
        validCreateData.status === 'success' &&
        createdOppId !== undefined &&
        validCreateData.data?.opportunity?.title === basePayload.title,
      'Test 13: Coordinator A successfully creates opportunity for own organization (201 Created)'
    );

    // =========================================================================
    // SECTION 3: MANAGED OPPORTUNITIES RETRIEVAL & ISOLATION
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 3: Managed Retrieval & Data Isolation ---${colors.reset}`);

    // Test 14: Coordinator A retrieves created opportunity via ?managed=true
    const coordAManagedRes = await fetch(`${baseUrl}/api/opportunities?managed=true`, {
      headers: { Authorization: `Bearer ${tokenCoordA}` },
    });
    const coordAManagedData = await coordAManagedRes.json();
    const oppListA = coordAManagedData.data?.opportunities || [];

    assert(
      coordAManagedRes.status === 200 && oppListA.length === 1 && oppListA[0].id === createdOppId,
      'Test 14: Coordinator A retrieves managed opportunities including newly created event (200 OK)'
    );

    // Test 15: Response includes joined metadata: organization_name, coordinator_id, active_signups, spots_remaining
    const oppA = oppListA[0];
    assert(
      oppA &&
        oppA.organization_name === 'Alpha Community Builders' &&
        oppA.coordinator_id !== undefined &&
        oppA.active_signups === 0 &&
        oppA.spots_remaining === 15,
      'Test 15: Opportunity record includes organization_name, coordinator_id, active_signups, and spots_remaining'
    );

    // Test 16: Coordinator B calling ?managed=true does NOT see Coordinator A's opportunity
    const coordBManagedRes = await fetch(`${baseUrl}/api/opportunities?managed=true`, {
      headers: { Authorization: `Bearer ${tokenCoordB}` },
    });
    const coordBManagedData = await coordBManagedRes.json();
    const oppListB = coordBManagedData.data?.opportunities || [];

    assert(
      coordBManagedRes.status === 200 && oppListB.length === 0,
      'Test 16: Coordinator B cannot see Coordinator A managed opportunities (Data isolation enforced)'
    );

    // Test 17: Normal GET /api/opportunities returns all opportunities for both roles
    const allOppsRes = await fetch(`${baseUrl}/api/opportunities`, {
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    const allOppsData = await allOppsRes.json();
    assert(
      allOppsRes.status === 200 &&
        Array.isArray(allOppsData.data?.opportunities) &&
        allOppsData.data.opportunities.some((o) => o.id === createdOppId),
      'Test 17: Public/all listing GET /api/opportunities returns opportunity with 200 OK'
    );

    // =========================================================================
    // SECTION 4: OPPORTUNITY PARTIAL UPDATE & CAPACITY SAFETY
    // =========================================================================
    console.log(`\n${colors.bold}--- SECTION 4: Opportunity Update & Capacity Protection ---${colors.reset}`);

    // Test 18: Unauthenticated update returns 401
    const unauthUpdateRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    assert(
      unauthUpdateRes.status === 401,
      'Test 18: Unauthenticated PATCH /api/opportunities/:id returns 401 Unauthorized'
    );

    // Test 19: Volunteer attempting update returns 403 Forbidden
    const volUpdateRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol}`,
      },
      body: JSON.stringify({ title: 'Volunteer Title' }),
    });
    assert(
      volUpdateRes.status === 403,
      'Test 19: Volunteer attempting PATCH /api/opportunities/:id returns 403 Forbidden'
    );

    // Test 20: Coordinator B attempting to update Coordinator A's opportunity returns 403
    const coordBUpdateRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordB}`,
      },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    assert(
      coordBUpdateRes.status === 403,
      'Test 20: Coordinator B updating Coordinator A opportunity rejected with 403 Forbidden'
    );

    // Test 21: Non-existent UUID returns 404
    const nonExistentUuid = 'a0000000-0000-0000-0000-000000000000';
    const notFoundRes = await fetch(`${baseUrl}/api/opportunities/${nonExistentUuid}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ title: 'Should Not Exist' }),
    });
    assert(
      notFoundRes.status === 404,
      'Test 21: Non-existent opportunity UUID returns 404 Not Found'
    );

    // Test 22: Invalid time update (end earlier than start) returns 400
    const badTimeUpdateRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ end_time: '08:00' }), // existing start_time is 09:00
    });
    assert(
      badTimeUpdateRes.status === 400,
      'Test 22: Update making end_time earlier than start_time returns 400 Bad Request'
    );

    // Test 23: Coordinator A successfully partially updates title and capacity
    const successUpdateRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({
        title: 'Riverbank Clean-up & Native Planting',
        capacity: 2,
      }),
    });
    const successUpdateData = await successUpdateRes.json();
    assert(
      successUpdateRes.status === 200 &&
        successUpdateData.data?.opportunity?.title === 'Riverbank Clean-up & Native Planting' &&
        successUpdateData.data?.opportunity?.capacity === 2,
      'Test 23: Coordinator A successfully partially updates title and capacity (200 OK)'
    );

    // Test 24: Volunteer signs up; active signup count increases
    const volSignupRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenVol}` },
    });
    assert(
      volSignupRes.status === 201,
      'Test 24: Volunteer successfully signs up for opportunity (201 Created)'
    );

    // Test 25: Coordinator A attempting to reduce capacity below active signups (now 1) rejected with 409 Conflict
    const conflictCapRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ capacity: 0 }), // or below active signups: capacity 0 is 400, capacity < 1 is 409
    });
    // Let's test capacity = 0 (400) and capacity = -1 (400), but if capacity is valid integer (e.g. 0 is rejected by validation)
    // Wait: what if capacity = 0? Validation rejects with 400 because capacity must be positive integer.
    // What if there are 2 active signups and coordinator reduces to 1? Or if capacity is reduced below active count?
    // Let's register another volunteer or test reducing capacity when active signups > new capacity:
    // Currently active signups = 1, current capacity = 2.
    // If coordinator tries to reduce capacity to 0, validator catches it (400).
    // Let's create a second volunteer to have 2 active signups, then try reducing capacity to 1:
    const vol2 = {
      full_name: 'Volunteer Delta Batch3',
      email: `vol.delta.${timestamp}@test.org`,
      password: 'Password123!',
      role: 'VOLUNTEER',
    };
    await registerUser(vol2);
    const loginVol2 = await loginUser(vol2.email, vol2.password);
    await fetch(`${baseUrl}/api/opportunities/${createdOppId}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginVol2.data?.token}` },
    });
    // Now there are 2 active signups for Opp (capacity = 2).
    // Now attempting to reduce capacity to 1 must trigger 409 Conflict!
    const conflictReduceRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ capacity: 1 }),
    });
    assert(
      conflictReduceRes.status === 409,
      'Test 25: Reducing capacity below active volunteer count (2) rejected with 409 Conflict'
    );

    // Test 26: Coordinator A updates status to 'COMPLETED' (200 OK)
    const statusUpdateRes = await fetch(`${baseUrl}/api/opportunities/${createdOppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoordA}`,
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    const statusUpdateData = await statusUpdateRes.json();
    assert(
      statusUpdateRes.status === 200 &&
        statusUpdateData.data?.opportunity?.status === 'COMPLETED',
      'Test 26: Coordinator A successfully updates opportunity status to COMPLETED (200 OK)'
    );

  } catch (error) {
    console.error(`\n${colors.red}Unhandled Exception in Batch 3 test suite:${colors.reset}`, error);
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
    console.log(`  BATCH 3 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`-------------------------------------------------------------${colors.reset}\n`);

    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
