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
  console.log(`  BATCH 5: ADVANCED ANALYTICS, REPORTS, NOTIFICATIONS & PROFILES `);
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
    full_name: 'Coordinator Batch5',
    email: `coord.batch5.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const coordOtherData = {
    full_name: 'Other Coordinator Batch5',
    email: `other.coord.batch5.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'COORDINATOR',
  };

  const volunteerData = {
    full_name: 'Volunteer Batch5',
    email: `volunteer.batch5.${timestamp}@test.org`,
    password: 'Password123!',
    role: 'VOLUNTEER',
  };

  let coordToken, otherCoordToken, volunteerToken;
  let coordUser, volunteerUser;
  let testOrgId, testOppId, testSignupId, testHoursId;

  try {
    // -------------------------------------------------------------
    // SETUP: Register & Login Users
    // -------------------------------------------------------------
    console.log(`${colors.yellow}--> Setting up test accounts and seeded data...${colors.reset}`);

    // Register Coordinator
    const regCoordRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordData),
    });
    const regCoordBody = await regCoordRes.json();
    assert(regCoordRes.status === 201, 'Register test coordinator returns 201');
    coordUser = regCoordBody.data.user;

    // Login Coordinator
    const loginCoordRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: coordData.email, password: coordData.password }),
    });
    const loginCoordBody = await loginCoordRes.json();
    coordToken = loginCoordBody.data.token;

    // Register & Login Other Coordinator
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coordOtherData),
    });
    const loginOtherCoordRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: coordOtherData.email, password: coordOtherData.password }),
    });
    otherCoordToken = (await loginOtherCoordRes.json()).data.token;

    // Register Volunteer
    const regVolRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(volunteerData),
    });
    const regVolBody = await regVolRes.json();
    assert(regVolRes.status === 201, 'Register test volunteer returns 201');
    volunteerUser = regVolBody.data.user;

    // Login Volunteer
    const loginVolRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteerData.email, password: volunteerData.password }),
    });
    const loginVolBody = await loginVolRes.json();
    volunteerToken = loginVolBody.data.token;

    // Create Organization
    const createOrgRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordToken}`,
      },
      body: JSON.stringify({
        name: `Eco Champions ${timestamp}`,
        description: 'Dedicated to community cleanups and green spaces',
      }),
    });
    const createOrgBody = await createOrgRes.json();
    testOrgId = createOrgBody.data.organization.id;
    assert(createOrgRes.status === 201 && testOrgId, 'Coordinator creates organization');

    // Create Opportunity
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const createOppRes = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordToken}`,
      },
      body: JSON.stringify({
        organization_id: testOrgId,
        title: `Community Park Cleanup ${timestamp}`,
        description: 'Help clean up the central community park',
        category: 'Environment',
        event_date: tomorrow,
        start_time: '09:00:00',
        end_time: '13:00:00',
        location: 'City Green Park',
        address: '100 Main St, Central',
        capacity: 25,
        status: 'PUBLISHED',
      }),
    });
    const createOppBody = await createOppRes.json();
    testOppId = createOppBody.data.opportunity.id;
    assert(createOppRes.status === 201 && testOppId, 'Coordinator creates published opportunity');

    // -------------------------------------------------------------
    // TEST SECTION 1: Volunteer Signup & Notification Trigger
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 1: Signup & Event Notification Triggers...${colors.reset}`);

    const signupRes = await fetch(`${baseUrl}/api/opportunities/${testOppId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volunteerToken}`,
      },
    });
    const signupBody = await signupRes.json();
    testSignupId = signupBody.data?.signup?.id;
    assert(signupRes.status === 201 && testSignupId, 'Volunteer signs up for opportunity');

    // Verify volunteer received Registration Confirmed notification
    const volNotifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const volNotifBody = await volNotifRes.json();
    assert(volNotifRes.status === 200, 'Volunteer fetches notifications');
    assert(volNotifBody.data.notifications.length >= 1, 'Volunteer has at least 1 notification');
    const regNotif = volNotifBody.data.notifications.find((n) => n.title === 'Registration Confirmed');
    assert(Boolean(regNotif), 'Volunteer received Registration Confirmed notification');
    assert(volNotifBody.data.unread_count >= 1, 'Unread notification count is correct');

    // Verify coordinator received New Registration notification
    const coordNotifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const coordNotifBody = await coordNotifRes.json();
    const coordRegNotif = coordNotifBody.data.notifications.find((n) => n.title === 'New Registration');
    assert(Boolean(coordRegNotif), 'Coordinator received New Registration notification');

    // -------------------------------------------------------------
    // TEST SECTION 2: Hours Recording, Status & Verification Notification
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 2: Hours Recording & Verification Notifications...${colors.reset}`);

    const recordHoursRes = await fetch(`${baseUrl}/api/signups/${testSignupId}/hours`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordToken}`,
      },
      body: JSON.stringify({
        hours: 4.5,
        status: 'RECORDED',
      }),
    });
    const recordHoursBody = await recordHoursRes.json();
    testHoursId = recordHoursBody.data?.volunteer_hours?.id;
    assert(recordHoursRes.status === 201 && testHoursId, 'Coordinator records 4.5 hours for volunteer');

    // Verify volunteer received Hours Submitted notification
    const volNotifRes2 = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const volNotifBody2 = await volNotifRes2.json();
    const submittedNotif = volNotifBody2.data.notifications.find((n) => n.title === 'Hours Submitted');
    assert(Boolean(submittedNotif), 'Volunteer received Hours Submitted notification');

    // Coordinator updates hours status to VERIFIED
    const verifyHoursRes = await fetch(`${baseUrl}/api/hours/${testHoursId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordToken}`,
      },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    assert(verifyHoursRes.status === 200, 'Coordinator verifies hours status');

    // Verify volunteer received Hours Verified notification
    const volNotifRes3 = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const volNotifBody3 = await volNotifRes3.json();
    const verifiedNotif = volNotifBody3.data.notifications.find((n) => n.title === 'Hours Verified');
    assert(Boolean(verifiedNotif), 'Volunteer received Hours Verified notification');

    // -------------------------------------------------------------
    // TEST SECTION 3: Notification Mark as Read & Read-All
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 3: Notification Read State Management...${colors.reset}`);

    // Mark single notification as read
    const markOneRes = await fetch(`${baseUrl}/api/notifications/${regNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const markOneBody = await markOneRes.json();
    assert(markOneRes.status === 200, 'Mark notification as read returns 200');
    assert(markOneBody.data.notification.is_read === true, 'Notification is_read is true');

    // Attempt marking other user's notification -> 404 forbidden/not found
    const markOtherRes = await fetch(`${baseUrl}/api/notifications/${regNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(markOtherRes.status === 404, 'Cannot mark another user notification as read (returns 404)');

    // Mark all as read
    const markAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    assert(markAllRes.status === 200, 'Mark all notifications as read returns 200');

    // Verify unread count is now 0
    const unreadCheckRes = await fetch(`${baseUrl}/api/notifications?unread=true`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const unreadCheckBody = await unreadCheckRes.json();
    assert(unreadCheckBody.data.unread_count === 0, 'Unread notification count is now 0');
    assert(unreadCheckBody.data.notifications.length === 0, 'Unread notifications filter returns empty list');

    // -------------------------------------------------------------
    // TEST SECTION 4: Analytics Aggregations
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 4: Analytics Engine (Volunteer & Coordinator)...${colors.reset}`);

    // Volunteer Analytics
    const volAnalyticsRes = await fetch(`${baseUrl}/api/analytics/volunteer`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const volAnalyticsBody = await volAnalyticsRes.json();
    assert(volAnalyticsRes.status === 200, 'Volunteer analytics endpoint returns 200');
    const volAnalytics = volAnalyticsBody.data.analytics || volAnalyticsBody.data;
    assert(typeof volAnalytics.metrics?.streak_weeks === 'number', 'Volunteer analytics includes streak_weeks');
    assert(volAnalytics.next_upcoming_event !== undefined, 'Volunteer analytics includes next_upcoming_event');
    assert(Array.isArray(volAnalytics.hours_by_month), 'Volunteer analytics includes hours_by_month');
    assert(volAnalytics.metrics?.total_hours >= 4.5, 'Volunteer metrics total_hours has >= 4.5 hours');
    assert(Array.isArray(volAnalytics.recent_activity), 'Volunteer analytics includes recent_activity timeline');

    // RBAC: Coordinator cannot access volunteer analytics
    const volAnalyticsCoordRes = await fetch(`${baseUrl}/api/analytics/volunteer`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(volAnalyticsCoordRes.status === 403, 'Coordinator accessing volunteer analytics returns 403 Forbidden');

    // Coordinator Analytics
    const coordAnalyticsRes = await fetch(`${baseUrl}/api/analytics/coordinator`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const coordAnalyticsBody = await coordAnalyticsRes.json();
    assert(coordAnalyticsRes.status === 200, 'Coordinator analytics endpoint returns 200');
    const coordAnalytics = coordAnalyticsBody.data.analytics || coordAnalyticsBody.data;
    assert(coordAnalytics.metrics?.total_volunteers >= 1, 'Coordinator analytics reports >= 1 total volunteer');
    assert(coordAnalytics.metrics?.active_opportunities >= 1, 'Coordinator analytics reports >= 1 active opportunity');
    assert(coordAnalytics.metrics?.total_hours >= 4.5, 'Coordinator analytics reports >= 4.5 total hours');
    assert(Array.isArray(coordAnalytics.hours_by_month), 'Coordinator analytics includes hours_by_month');
    assert(Array.isArray(coordAnalytics.registrations_by_month), 'Coordinator analytics includes registrations_by_month');
    assert(Array.isArray(coordAnalytics.volunteers_per_opportunity), 'Coordinator analytics includes volunteers_per_opportunity');
    assert(Array.isArray(coordAnalytics.category_breakdown), 'Coordinator analytics includes category_breakdown');
    assert(typeof coordAnalytics.event_status_distribution === 'object', 'Coordinator analytics includes event_status_distribution');

    // RBAC: Volunteer cannot access coordinator analytics
    const coordAnalyticsVolRes = await fetch(`${baseUrl}/api/analytics/coordinator`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    assert(coordAnalyticsVolRes.status === 403, 'Volunteer accessing coordinator analytics returns 403 Forbidden');

    // -------------------------------------------------------------
    // TEST SECTION 5: Reports Engine & CSV Exports
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 5: Reports Engine & CSV Exports...${colors.reset}`);

    // Report 1: Volunteer Participation (JSON)
    const partRepRes = await fetch(`${baseUrl}/api/reports/volunteer-participation`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const partRepBody = await partRepRes.json();
    assert(partRepRes.status === 200, 'Volunteer participation report returns 200');
    assert(Array.isArray(partRepBody.data.report), 'Participation report data is an array');
    assert(partRepBody.data.report.length >= 1, 'Participation report contains volunteer row');

    // Report 1: Volunteer Participation (CSV)
    const partCsvRes = await fetch(`${baseUrl}/api/reports/volunteer-participation?format=csv`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const partCsvText = await partCsvRes.text();
    assert(partCsvRes.status === 200, 'Participation CSV export returns 200');
    assert(partCsvRes.headers.get('content-type')?.includes('text/csv'), 'Participation CSV returns text/csv content-type');
    assert(partCsvText.includes('Volunteer Name') && partCsvText.includes('Total Hours'), 'Participation CSV contains expected headers');

    // Report 2: Volunteer Hours (JSON & CSV)
    const hoursRepRes = await fetch(`${baseUrl}/api/reports/volunteer-hours`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const hoursRepBody = await hoursRepRes.json();
    assert(hoursRepRes.status === 200, 'Volunteer hours report returns 200');
    assert(hoursRepBody.data.report.length >= 1, 'Volunteer hours report contains entries');

    const hoursCsvRes = await fetch(`${baseUrl}/api/reports/volunteer-hours?format=csv`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const hoursCsvText = await hoursCsvRes.text();
    assert(hoursCsvRes.status === 200, 'Volunteer hours CSV returns 200');
    assert(hoursCsvText.includes('Hours') && hoursCsvText.includes('Status'), 'Volunteer hours CSV contains expected headers');

    // Report 3: Opportunity Performance (JSON & CSV)
    const perfRepRes = await fetch(`${baseUrl}/api/reports/opportunity-performance`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const perfRepBody = await perfRepRes.json();
    assert(perfRepRes.status === 200, 'Opportunity performance report returns 200');
    assert(perfRepBody.data.report.length >= 1, 'Opportunity performance report contains entries');

    const perfCsvRes = await fetch(`${baseUrl}/api/reports/opportunity-performance?format=csv`, {
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    const perfCsvText = await perfCsvRes.text();
    assert(perfCsvRes.status === 200, 'Opportunity performance CSV returns 200');
    assert(perfCsvText.includes('Opportunity Title') && perfCsvText.includes('Fill Rate %'), 'Opportunity performance CSV contains expected headers');

    // RBAC: Volunteer cannot access reports
    const volRepRes = await fetch(`${baseUrl}/api/reports/volunteer-hours`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    assert(volRepRes.status === 403, 'Volunteer cannot access reports (returns 403 Forbidden)');

    // -------------------------------------------------------------
    // TEST SECTION 6: User Profile & Settings Management
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 6: User Profile & Settings...${colors.reset}`);

    // Get User Profile
    const profileRes = await fetch(`${baseUrl}/api/users/profile`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const profileBody = await profileRes.json();
    assert(profileRes.status === 200, 'GET /api/users/profile returns 200');
    assert(profileBody.data.user.email === volunteerData.email, 'Profile contains user email');
    assert(typeof profileBody.data.user.stats === 'object', 'Profile contains stats object');
    assert(profileBody.data.user.stats.total_hours !== undefined, 'Volunteer profile stats contains total_hours');

    // Update User Profile
    const updateProfileRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volunteerToken}`,
      },
      body: JSON.stringify({
        bio: 'Passionate community organizer and environment enthusiast',
        location: 'Koramangala, Bengaluru',
        phone: '+91 98765 43210',
        skills: ['Environmental Work', 'Teamwork', 'Communication'],
      }),
    });
    const updateProfileBody = await updateProfileRes.json();
    assert(updateProfileRes.status === 200, 'PATCH /api/users/profile returns 200');
    assert(updateProfileBody.data.user.bio.includes('Passionate community'), 'Profile bio was updated');
    assert(updateProfileBody.data.user.location === 'Koramangala, Bengaluru', 'Profile location was updated');
    assert(Array.isArray(updateProfileBody.data.user.skills) && updateProfileBody.data.user.skills.length === 3, 'Profile skills updated');

    // Change Password via POST /api/auth/change-password
    const changePassFailRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volunteerToken}`,
      },
      body: JSON.stringify({
        current_password: 'WrongPassword!',
        new_password: 'NewSecurePassword123!',
      }),
    });
    assert(changePassFailRes.status === 400, 'Change password with wrong current password returns 400');

    const changePassSuccessRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volunteerToken}`,
      },
      body: JSON.stringify({
        current_password: 'Password123!',
        new_password: 'NewSecurePassword123!',
      }),
    });
    assert(changePassSuccessRes.status === 200, 'Change password with correct credentials returns 200');

    // Verify login with new password
    const loginNewPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: volunteerData.email, password: 'NewSecurePassword123!' }),
    });
    assert(loginNewPassRes.status === 200, 'Login with new updated password succeeds');

    // -------------------------------------------------------------
    // TEST SECTION 7: Organization Profile & Impact Metrics
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}--> Section 7: Organization Profile & Impact Analytics...${colors.reset}`);

    // Get Organization Impact
    const orgImpactRes = await fetch(`${baseUrl}/api/organizations/${testOrgId}/impact`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const orgImpactBody = await orgImpactRes.json();
    assert(orgImpactRes.status === 200, 'GET /api/organizations/:id/impact returns 200');
    assert(orgImpactBody.data.organization.name.includes('Eco Champions'), 'Impact returns organization details');
    assert(typeof orgImpactBody.data.impact.total_opportunities === 'number', 'Impact contains total_opportunities');
    assert(typeof orgImpactBody.data.impact.event_fill_rate === 'number', 'Impact contains event_fill_rate');
    assert(typeof orgImpactBody.data.impact.hour_verification_rate === 'number', 'Impact contains hour_verification_rate');

    // Update Organization Profile (Coordinator Owner)
    const updateOrgRes = await fetch(`${baseUrl}/api/organizations/${testOrgId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${coordToken}`,
      },
      body: JSON.stringify({
        phone: '+91 80 2322 3333',
        email: 'contact@ecochampions.org',
        website: 'https://ecochampions.org',
        address: 'Koramangala, Bengaluru',
        social_links: {
          twitter: '@ecochampions',
          instagram: '@ecochampionsorg',
        },
      }),
    });
    const updateOrgBody = await updateOrgRes.json();
    assert(updateOrgRes.status === 200, 'Owning coordinator updates organization profile');
    assert(updateOrgBody.data.organization.phone === '+91 80 2322 3333', 'Organization phone updated');
    assert(updateOrgBody.data.organization.website === 'https://ecochampions.org', 'Organization website updated');

    // Update Organization Profile (Unauthorized Coordinator)
    const updateOrgOtherRes = await fetch(`${baseUrl}/api/organizations/${testOrgId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherCoordToken}`,
      },
      body: JSON.stringify({ name: 'Hacked Organization' }),
    });
    assert(updateOrgOtherRes.status === 403, 'Non-owner coordinator cannot update organization (returns 403 Forbidden)');

  } catch (err) {
    console.error('Test execution failed unexpectedly:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    // Clean up DB pool
    await pool.end();
  }

  console.log(`\n${colors.bold}-------------------------------------------------------------`);
  console.log(`  BATCH 5 SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`-------------------------------------------------------------${colors.reset}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runTests();
