require('dotenv').config();
const app = require('../src/app');
const fetch = require('./helpers/testFetch');
const pool = require('../src/config/db');

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
  console.log(`  SIGNUP REGRESSION TEST SUITE                               `);
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
    full_name: 'Coordinator One Day 28',
    email: `coord1.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordinator2 = {
    full_name: 'Coordinator Two Day 28',
    email: `coord2.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteer1 = {
    full_name: 'Volunteer Alice Day 28',
    email: `vol1.signup.detail.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteer2 = {
    full_name: 'Volunteer Bob Day 28',
    email: `vol2.signup.detail.${timestamp}@test.org`,
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
           SELECT id FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id IN (
             SELECT id FROM users WHERE email = ANY($1)
           ))
         )
       )`,
      [testEmails]
    );
    await pool.query(
      `DELETE FROM opportunities WHERE organization_id IN (
         SELECT id FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id IN (
           SELECT id FROM users WHERE email = ANY($1)
         ))
       )`,
      [testEmails]
    );
    await pool.query(
      `DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id IN (
         SELECT id FROM users WHERE email = ANY($1)
       ))`,
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
    await registerUser(coordinator1);
    await registerUser(coordinator2);
    await registerUser(volunteer1);
    await registerUser(volunteer2);


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

    const org1Id = await createOrg(`Org One Detail ${timestamp}`, tokenCoord1);
    const org2Id = await createOrg(`Org Two Detail ${timestamp}`, tokenCoord2);

    // Helper: create opportunity
    const createOpp = async (orgId, title, capacity, token) => {
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
          event_date: '2030-11-25',
          start_time: '09:00:00',
          end_time: '12:00:00',
          location: 'City Green Park',
          address: '200 Park Way',
          capacity,
          status: 'PUBLISHED',
        }),
      });
      const data = await res.json();
      return data.data.opportunity.id;
    };

    // Opp 1A & 1B under Coordinator 1
    const opp1A_Id = await createOpp(org1Id, 'Tree Planting Initiative', 10, tokenCoord1);
    const opp1B_Id = await createOpp(org1Id, 'Riverbank Clean', 10, tokenCoord1);
    // Opp 2 under Coordinator 2
    const opp2_Id = await createOpp(org2Id, 'Coastal Bird Sanctuary Protection', 10, tokenCoord2);

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

    // Signups:
    // Alice signs up for Opp 1A and Opp 1B (under Coordinator 1)
    const signup1A_Alice = await signupVolunteer(opp1A_Id, tokenVol1);
    await signupVolunteer(opp1B_Id, tokenVol1);
    // Bob signs up for Opp 2 (under Coordinator 2)
    await signupVolunteer(opp2_Id, tokenVol2);

    console.log(`${colors.yellow}Test entities prepared successfully.${colors.reset}\n`);

    // ================================================================
    // Regression: signup, status, organization, opportunity and hours endpoints
    // ================================================================
    console.log(`\n${colors.bold}Regression: signup, status and hours endpoints${colors.reset}`);

    // Test 19: Volunteer cancellation (DELETE /api/opportunities/:id/signup) works
    const volCancelRes = await fetch(`${baseUrl}/api/opportunities/${opp1B_Id}/signup`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol1}`,
      },
    });
    const volCancelData = await volCancelRes.json();
    assert(
      volCancelRes.status === 200 && volCancelData.data?.signup?.status === 'CANCELLED',
      'Test 19: Volunteer cancellation (DELETE /api/opportunities/:id/signup) works (200 OK)'
    );

    // Test 20: Coordinator signup status update to CANCELLED (Day 27) remains operational
    const coordCancelRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert(
      coordCancelRes.status === 200,
      'Test 20: Day 27 PATCH /api/signups/:id/status to CANCELLED remains operational (200 OK)'
    );

    // Test 21: Coordinator signup status update to REGISTERED (Day 27) remains operational
    const coordRegRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'REGISTERED' }),
    });
    assert(
      coordRegRes.status === 200,
      'Test 21: Day 27 PATCH /api/signups/:id/status to REGISTERED remains operational (200 OK)'
    );

    // Test 22: POST /api/organizations enforces one NGO per account
    const regOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        name: `Regression Org Detail ${timestamp}`,
        description: 'Detail regression testing',
      }),
    });
    const regOrgData = await regOrgRes.json();
    assert(
      regOrgRes.status === 409 && regOrgData.code === 'ALREADY_OWNS_ORGANIZATION',
      'Test 22: A coordinator who already runs an NGO cannot register another (409)'
    );

    // Test 23: Day 18 POST /api/opportunities remains operational
    const regOppRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({
        organization_id: org1Id,
        title: 'Detail Regression Opp',
        description: 'Detail regression testing',
        category: 'Health',
        event_date: '2030-12-10',
        start_time: '10:00:00',
        end_time: '13:00:00',
        location: 'Hospital',
        address: '500 Health Blvd',
        capacity: 10,
        status: 'PUBLISHED',
      }),
    });
    assert(
      regOppRes.status === 201,
      'Test 23: Day 18 POST /api/opportunities remains operational (201 Created)'
    );

    // Test 24: Day 19 GET /api/signups/my remains operational
    const regMySignupsRes = await fetch(`${baseUrl}/api/signups/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regMySignupsRes.status === 200,
      'Test 24: Day 19 GET /api/signups/my remains operational (200 OK)'
    );

    // Test 25: Day 20 POST /api/signups/:id/hours remains operational
    const regHoursRes = await fetch(`${baseUrl}/api/signups/${signup1A_Alice}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ hours: 4.0, status: 'RECORDED' }),
    });
    const regHoursData = await regHoursRes.json();
    const regHourId = regHoursData.data?.volunteer_hours?.id;
    assert(
      regHoursRes.status === 201 && regHourId !== undefined,
      'Test 25: Day 20 POST /api/signups/:id/hours remains operational (201 Created)'
    );

    // Test 26: Day 21 GET /api/hours/my remains operational
    const regMyHoursRes = await fetch(`${baseUrl}/api/hours/my`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regMyHoursRes.status === 200,
      'Test 26: Day 21 GET /api/hours/my remains operational (200 OK)'
    );

    // Test 27: Day 22 PATCH /api/hours/:id/status remains operational
    const regPatchHourRes = await fetch(`${baseUrl}/api/hours/${regHourId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCoord1}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(
      regPatchHourRes.status === 200,
      'Test 27: Day 22 PATCH /api/hours/:id/status remains operational (200 OK)'
    );

    // Test 28: Day 23 GET /api/hours/my/summary remains operational
    const regSummaryRes = await fetch(`${baseUrl}/api/hours/my/summary`, {
      headers: { Authorization: `Bearer ${tokenVol1}` },
    });
    assert(
      regSummaryRes.status === 200,
      'Test 28: Day 23 GET /api/hours/my/summary remains operational (200 OK)'
    );

    // Test 29: Day 24 & 25 GET /api/hours/organization/opportunities with date filter remains operational
    const regOppSummaryRes = await fetch(
      `${baseUrl}/api/hours/organization/opportunities?from_date=2026-01-01&to_date=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${tokenCoord1}` },
      }
    );
    assert(
      regOppSummaryRes.status === 200,
      'Test 29: Day 24 & 25 GET /api/hours/organization/opportunities with date filter remains operational (200 OK)'
    );

    // Test 30: Day 26 GET /api/hours/my?from_date=2026-01-01&to_date=2026-12-31 remains operational
    const regDateHoursRes = await fetch(
      `${baseUrl}/api/hours/my?from_date=2026-01-01&to_date=2026-12-31`,
      {
        headers: { Authorization: `Bearer ${tokenVol1}` },
      }
    );
    assert(
      regDateHoursRes.status === 200,
      'Test 30: Day 26 GET /api/hours/my date-based retrieval remains operational (200 OK)'
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
  console.log(`  DAY 28 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
