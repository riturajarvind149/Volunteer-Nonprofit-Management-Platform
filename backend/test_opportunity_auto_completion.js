require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/config/db');
const {
  processCompletedOpportunities,
  startOpportunityCompletionScheduler,
  stopOpportunityCompletionScheduler,
  isSchedulerRunning,
} = require('./src/services/opportunityCompletionService');

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
  console.log(`  OPPORTUNITY AUTOMATIC COMPLETION & NOTIFICATION TEST SUITE `);
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
  const coordData = {
    full_name: 'Coordinator AutoComplete',
    email: `coord.autocomplete.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteerAliceData = {
    full_name: 'Alice Registered AutoComplete',
    email: `alice.ac.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  const volunteerBobData = {
    full_name: 'Bob Cancelled AutoComplete',
    email: `bob.ac.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  let coordToken, aliceToken, bobToken;
  let coordUser, aliceUser, bobUser;
  let testOrgId;

  try {
    // -------------------------------------------------------------
    // SETUP: Register test entities
    // -------------------------------------------------------------
    console.log(`${colors.yellow}--> Setting up test coordinators and volunteers...${colors.reset}`);

    // Register & Login Coordinator
    const regCoord = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordData),
    });
    coordUser = (await regCoord.json()).data.user;

    const loginCoord = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: coordData.email, password: coordData.password }),
    });
    coordToken = (await loginCoord.json()).data.token;

    // Register & Login Alice
    const regAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(volunteerAliceData),
    });
    aliceUser = (await regAlice.json()).data.user;

    const loginAlice = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteerAliceData.email, password: volunteerAliceData.password }),
    });
    aliceToken = (await loginAlice.json()).data.token;

    // Register & Login Bob
    const regBob = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(volunteerBobData),
    });
    bobUser = (await regBob.json()).data.user;

    const loginBob = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteerBobData.email, password: volunteerBobData.password }),
    });
    bobToken = (await loginBob.json()).data.token;

    // Create Organization
    const createOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordToken}`,
      },
      body: JSON.stringify({
        name: `Civic Cleanups ${timestamp}`,
        description: 'Neighborhood beautification organization',
      }),
    });
    testOrgId = (await createOrgRes.json()).data.organization.id;
    assert(Boolean(testOrgId), 'Test organization initialized');

    // -------------------------------------------------------------
    // TEST GROUP 1: Eligible Past Opportunity Completion & Notification
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Group 1: Past Published Event Auto-Completion...${colors.reset}`);

    // Create an opportunity in the past (yesterday 09:00 - 13:00)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const insertPastOppQuery = `
      INSERT INTO opportunities (
        organization_id, title, description, category, event_date,
        start_time, end_time, location, capacity, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PUBLISHED')
      RETURNING id, title, status
    `;
    const pastOppRes = await pool.query(insertPastOppQuery, [
      testOrgId,
      `Past River Clean Drive ${timestamp}`,
      'Completed river drive',
      'Environment',
      yesterday,
      '09:00:00',
      '13:00:00',
      'Riverbank North',
      20,
    ]);
    const pastOppId = pastOppRes.rows[0].id;
    assert(Boolean(pastOppId), 'Past published opportunity created');

    // Alice registers (status = REGISTERED)
    const signupAliceRes = await fetch(`${baseUrl}/api/opportunities/${pastOppId}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const signupAliceBody = await signupAliceRes.json();
    const aliceSignupId = signupAliceBody.data?.signup?.id;
    assert(signupAliceRes.status === 201 && aliceSignupId, 'Alice signs up for past opportunity');

    // Bob registers and then cancels (status = CANCELLED)
    const signupBobRes = await fetch(`${baseUrl}/api/opportunities/${pastOppId}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobSignupId = (await signupBobRes.json()).data?.signup?.id;

    const cancelBobRes = await fetch(`${baseUrl}/api/signups/${bobSignupId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert(cancelBobRes.status === 200, 'Bob cancels his signup');

    // Verify Bob's DB status is CANCELLED
    const bobDbCheck = await pool.query('SELECT status FROM signups WHERE id = $1', [bobSignupId]);
    assert(bobDbCheck.rows[0].status === 'CANCELLED', 'Bob signup state is confirmed CANCELLED');

    // Clear initial signup notifications for clean baseline
    await pool.query('DELETE FROM notifications WHERE user_id = $1 OR user_id = $2', [aliceUser.id, bobUser.id]);

    // RUN COMPLETION PROCESS
    const completionResult1 = await processCompletedOpportunities();
    assert(completionResult1.completed_count >= 1, 'Automatic completion transitions past event');

    // Verify opportunity status in database is now COMPLETED
    const oppDbCheck1 = await pool.query('SELECT status FROM opportunities WHERE id = $1', [pastOppId]);
    assert(oppDbCheck1.rows[0].status === 'COMPLETED', 'Past opportunity status is now COMPLETED');

    // Verify Alice (registered) received EVENT_COMPLETED notification
    const aliceNotifsRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const aliceNotifs = (await aliceNotifsRes.json()).data?.notifications || [];
    const aliceCompNotif = aliceNotifs.find((n) => n.reference_id === pastOppId && n.type === 'EVENT_COMPLETED');
    assert(Boolean(aliceCompNotif), 'Alice received EVENT_COMPLETED notification');
    assert(
      aliceCompNotif?.message.includes('Please log your volunteer hours'),
      'Completion notification prompts user to log volunteer hours'
    );

    // Verify Bob (cancelled) did NOT receive completion notification
    const bobNotifsRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobNotifs = (await bobNotifsRes.json()).data?.notifications || [];
    const bobCompNotif = bobNotifs.find((n) => n.reference_id === pastOppId && n.type === 'EVENT_COMPLETED');
    assert(!bobCompNotif, 'Cancelled attendee (Bob) received NO completion notification');

    // -------------------------------------------------------------
    // TEST GROUP 2: Future Event Remains Unchanged
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Group 2: Future Published Event Remains Unchanged...${colors.reset}`);

    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const insertFutureOppQuery = `
      INSERT INTO opportunities (
        organization_id, title, description, category, event_date,
        start_time, end_time, location, capacity, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PUBLISHED')
      RETURNING id, status
    `;
    const futureOppRes = await pool.query(insertFutureOppQuery, [
      testOrgId,
      `Future Tree Plantation ${timestamp}`,
      'Future tree planting drive',
      'Environment',
      nextWeek,
      '10:00:00',
      '14:00:00',
      'Botanical Gardens',
      30,
    ]);
    const futureOppId = futureOppRes.rows[0].id;

    // Alice registers for future event
    await fetch(`${baseUrl}/api/opportunities/${futureOppId}/signup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });

    // Run completion process again
    await processCompletedOpportunities();

    // Verify future opportunity is still PUBLISHED
    const futureDbCheck = await pool.query('SELECT status FROM opportunities WHERE id = $1', [futureOppId]);
    assert(futureDbCheck.rows[0].status === 'PUBLISHED', 'Future event remains PUBLISHED');

    // Verify Alice received NO completion notification for future event
    const aliceNotifsResFuture = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const aliceNotifsFuture = (await aliceNotifsResFuture.json()).data?.notifications || [];
    const aliceFutureCompNotif = aliceNotifsFuture.find(
      (n) => n.reference_id === futureOppId && n.type === 'EVENT_COMPLETED'
    );
    assert(!aliceFutureCompNotif, 'No completion notification sent for future event');

    // -------------------------------------------------------------
    // TEST GROUP 3: Draft & Cancelled Events Remain Unchanged
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Group 3: DRAFT & CANCELLED Events Remain Unchanged...${colors.reset}`);

    // Past DRAFT event
    const insertDraftQuery = `
      INSERT INTO opportunities (
        organization_id, title, description, category, event_date,
        start_time, end_time, location, capacity, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT')
      RETURNING id, status
    `;
    const draftRes = await pool.query(insertDraftQuery, [
      testOrgId,
      `Draft Past Event ${timestamp}`,
      'Draft event',
      'Education',
      yesterday,
      '09:00:00',
      '12:00:00',
      'Library',
      15,
    ]);
    const draftOppId = draftRes.rows[0].id;

    // Past CANCELLED event
    const insertCancelledQuery = `
      INSERT INTO opportunities (
        organization_id, title, description, category, event_date,
        start_time, end_time, location, capacity, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CANCELLED')
      RETURNING id, status
    `;
    const cancelledRes = await pool.query(insertCancelledQuery, [
      testOrgId,
      `Cancelled Past Event ${timestamp}`,
      'Cancelled event',
      'Health',
      yesterday,
      '09:00:00',
      '12:00:00',
      'Clinic',
      10,
    ]);
    const cancelledOppId = cancelledRes.rows[0].id;

    await processCompletedOpportunities();

    const draftCheck = await pool.query('SELECT status FROM opportunities WHERE id = $1', [draftOppId]);
    assert(draftCheck.rows[0].status === 'DRAFT', 'Past DRAFT event remains DRAFT (not overwritten)');

    const cancelledCheck = await pool.query('SELECT status FROM opportunities WHERE id = $1', [cancelledOppId]);
    assert(cancelledCheck.rows[0].status === 'CANCELLED', 'Past CANCELLED event remains CANCELLED (not overwritten)');

    // -------------------------------------------------------------
    // TEST GROUP 4: Idempotence & Deduplication on Repeated Runs
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Group 4: Repeated Runs & Notification Deduplication...${colors.reset}`);

    // Run process completed opportunities 3 times in a row
    await processCompletedOpportunities();
    await processCompletedOpportunities();
    await processCompletedOpportunities();

    // Verify Alice still has exactly 1 EVENT_COMPLETED notification for pastOppId
    const countNotifsQuery = `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = $1 AND reference_id = $2 AND type = 'EVENT_COMPLETED'
    `;
    const countRes = await pool.query(countNotifsQuery, [aliceUser.id, pastOppId]);
    assert(countRes.rows[0].count === 1, 'Exactly 1 completion notification persisted after repeated runs');

    // -------------------------------------------------------------
    // TEST GROUP 5: Date/Time Boundary and Overnight Precision
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Group 5: Time Boundaries & Overnight Schedule Handling...${colors.reset}`);

    // Boundary Test A: Event today whose start_time was earlier today, but end_time is in the future
    // e.g. Start at 00:01, End at 23:59:59
    const today = new Date().toISOString().split('T')[0];
    const insertActiveTodayQuery = `
      INSERT INTO opportunities (
        organization_id, title, description, category, event_date,
        start_time, end_time, location, capacity, status
      )
      VALUES ($1, $2, $3, $4, $5, '00:01:00', '23:59:59', $6, 10, 'PUBLISHED')
      RETURNING id, status
    `;
    const activeTodayRes = await pool.query(insertActiveTodayQuery, [
      testOrgId,
      `Active Today Ongoing ${timestamp}`,
      'Ongoing today',
      'Community',
      today,
      'Town Hall',
    ]);
    const activeTodayOppId = activeTodayRes.rows[0].id;

    // Using simulated time of 12:00 today (mid-event)
    const simulatedMidDay = `${today}T12:00:00Z`;
    await processCompletedOpportunities({ now: simulatedMidDay, timezone: 'UTC' });

    const activeTodayCheck = await pool.query('SELECT status FROM opportunities WHERE id = $1', [activeTodayOppId]);
    assert(
      activeTodayCheck.rows[0].status === 'PUBLISHED',
      'Event that has started but not reached end_time remains PUBLISHED (Not completed merely because date started)'
    );

    // Boundary Test B: Overnight event starting 22:00, ending 02:00 next morning
    const insertOvernightQuery = `
      INSERT INTO opportunities (
        organization_id, title, description, category, event_date,
        start_time, end_time, location, capacity, status
      )
      VALUES ($1, $2, $3, $4, $5, '22:00:00', '02:00:00', $6, 10, 'PUBLISHED')
      RETURNING id, status
    `;
    const overnightRes = await pool.query(insertOvernightQuery, [
      testOrgId,
      `Overnight Vigil ${timestamp}`,
      'Overnight community vigil',
      'Community',
      today,
      'Observatory',
    ]);
    const overnightOppId = overnightRes.rows[0].id;

    // Simulation 1: 23:30 same night (still running)
    const simOvernightRunning = `${today}T23:30:00Z`;
    await processCompletedOpportunities({ now: simOvernightRunning, timezone: 'UTC' });
    const overnightRunningCheck = await pool.query('SELECT status FROM opportunities WHERE id = $1', [overnightOppId]);
    assert(overnightRunningCheck.rows[0].status === 'PUBLISHED', 'Overnight event is NOT completed at 23:30 same night');

    // Simulation 2: 02:05 next morning (completed)
    const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const simOvernightEnded = `${tomorrowDate}T02:05:00Z`;
    await processCompletedOpportunities({ now: simOvernightEnded, timezone: 'UTC' });
    const overnightEndedCheck = await pool.query('SELECT status FROM opportunities WHERE id = $1', [overnightOppId]);
    assert(overnightEndedCheck.rows[0].status === 'COMPLETED', 'Overnight event is COMPLETED after 02:00 next morning');

    // -------------------------------------------------------------
    // TEST GROUP 6: HTTP Endpoint & Scheduler Lifecycle
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Group 6: HTTP Maintenance Endpoint & Background Scheduler Lifecycle...${colors.reset}`);

    // Call POST /api/opportunities/process-completions
    const httpProcessRes = await fetch(`${baseUrl}/api/opportunities/process-completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const httpProcessBody = await httpProcessRes.json();
    assert(httpProcessRes.status === 200, 'POST /api/opportunities/process-completions returns 200 OK');
    assert(typeof httpProcessBody.data.completed_count === 'number', 'Endpoint returns completed_count summary');

    // RBAC: Volunteer cannot trigger process-completions
    const httpVolProcessRes = await fetch(`${baseUrl}/api/opportunities/process-completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(httpVolProcessRes.status === 403, 'Volunteer cannot call process-completions (returns 403 Forbidden)');

    // Test Scheduler start & stop
    assert(!isSchedulerRunning(), 'Scheduler is initially not active in test process');
    startOpportunityCompletionScheduler(500);
    assert(isSchedulerRunning(), 'Scheduler start initializes running state');
    stopOpportunityCompletionScheduler();
    assert(!isSchedulerRunning(), 'Scheduler stop gracefully cleans up state');

  } catch (err) {
    console.error('Test execution failed unexpectedly:', err);
    failed++;
  } finally {
    stopOpportunityCompletionScheduler();
    if (server) {
      server.close();
    }
    await pool.end();
  }

  console.log(`\n${colors.bold}-------------------------------------------------------------`);
  console.log(`  COMPLETION SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`-------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests();
