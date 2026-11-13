/**
 * Production-readiness feature suite.
 * Runs with email verification and organization approval ENABLED.
 *
 * Covers: email verification, password reset, session revocation, admin
 * organization review, publish gating, public browsing/search/pagination,
 * draft privacy, waitlist + auto-promotion, check-in, attendance,
 * self-logged hours + review, certificate PDF, calendar (.ics), account
 * suspension, data export and account deletion.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.REQUIRE_ORG_APPROVAL = 'true';
process.env.RATE_LIMIT_ENABLED = 'false';

const bcrypt = require('bcrypt');
const app = require('./src/app');
const pool = require('./src/config/db');
const { migrate } = require('./src/db/migrate');
const emailService = require('./src/services/emailService');

const c = { green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m' };
let passed = 0;
let failed = 0;
const assert = (cond, label, detail = '') => {
  if (cond) {
    passed++;
    console.log(` ${c.green}✔ PASS${c.reset} - ${label}`);
  } else {
    failed++;
    console.error(` ${c.red}✖ FAIL${c.reset} - ${label}`);
    if (detail) console.error(`        Detail: ${detail}`);
  }
};
const section = (t) => console.log(`\n${c.bold}${c.cyan}--> ${t}${c.reset}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server;
let baseUrl;
const stamp = Date.now();
const createdUserEmails = [];

const api = async (method, path, { token, body, raw } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
};

/** Pull the token out of the most recent email sent to an address. */
const tokenFromEmail = (to, pathPart) => {
  const mail = [...emailService.getOutbox()].reverse().find((m) => m.to === to && m.cta?.url.includes(pathPart));
  if (!mail) return null;
  return new URL(mail.cta.url).searchParams.get('token');
};

const register = async (prefix, role) => {
  const email = `${prefix}.${stamp}@prodtest.org`;
  createdUserEmails.push(email);
  const res = await api('POST', '/api/auth/register', {
    body: { full_name: `${prefix} Tester`, email, password: 'Password123!', role },
  });
  return { email, res };
};

const verifyAndLogin = async (email) => {
  const token = tokenFromEmail(email, '/verify-email');
  await api('POST', '/api/auth/verify-email', { body: { token } });
  const login = await api('POST', '/api/auth/login', { body: { email, password: 'Password123!' } });
  return { token: login.data.data?.token, user: login.data.data?.user };
};

const run = async () => {
  console.log(`${c.bold}${c.cyan}PRODUCTION FEATURES TEST SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
  emailService.clearOutbox();

  // ------------------------------------------------------------------
  section('Security headers & input hardening');
  const health = await api('GET', '/api/health', { raw: true });
  assert(health.headers.get('x-content-type-options') === 'nosniff', 'Helmet security headers are set');
  assert(!health.headers.get('x-powered-by'), 'X-Powered-By header is hidden');
  assert(Boolean(health.headers.get('x-request-id')), 'Responses carry an X-Request-Id');
  const badJson = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert(badJson.status === 400, 'Malformed JSON returns 400 instead of 500');
  const noBody = await api('POST', '/api/auth/login');
  assert(noBody.status === 400, 'Missing body returns 400 instead of 500');

  // ------------------------------------------------------------------
  section('Registration & email verification');
  const weak = await api('POST', '/api/auth/register', {
    body: { full_name: 'Weak', email: `weak.${stamp}@prodtest.org`, password: 'onlyletters', role: 'VOLUNTEER' },
  });
  assert(weak.status === 400, 'Password without a number is rejected');

  const vol = await register('vol', 'VOLUNTEER');
  assert(vol.res.status === 201 && vol.res.data.data.requires_email_verification === true, 'Registration requires email verification');
  assert(Boolean(tokenFromEmail(vol.email, '/verify-email')), 'Verification email is sent');

  const preVerifyLogin = await api('POST', '/api/auth/login', { body: { email: vol.email, password: 'Password123!' } });
  assert(preVerifyLogin.status === 403 && preVerifyLogin.data.code === 'EMAIL_NOT_VERIFIED', 'Login blocked until email is verified');

  const badVerify = await api('POST', '/api/auth/verify-email', { body: { token: 'not-a-real-token' } });
  assert(badVerify.status === 400, 'Invalid verification token is rejected');

  const resend = await api('POST', '/api/auth/resend-verification', { body: { email: vol.email } });
  assert(resend.status === 200, 'Resend verification responds generically');

  const verifyToken = tokenFromEmail(vol.email, '/verify-email');
  const verify = await api('POST', '/api/auth/verify-email', { body: { token: verifyToken } });
  assert(verify.status === 200, 'Email verification succeeds');
  const reuse = await api('POST', '/api/auth/verify-email', { body: { token: verifyToken } });
  assert(reuse.status === 400, 'Verification token is single-use');

  let volLogin = await api('POST', '/api/auth/login', { body: { email: vol.email.toUpperCase(), password: 'Password123!' } });
  assert(volLogin.status === 200, 'Login works after verification (email is case-insensitive)');
  let volToken = volLogin.data.data.token;
  const volId = volLogin.data.data.user.id;

  // ------------------------------------------------------------------
  section('Password reset & session revocation');
  const unknownReset = await api('POST', '/api/auth/forgot-password', { body: { email: `nobody.${stamp}@prodtest.org` } });
  assert(unknownReset.status === 200, 'Forgot-password does not reveal unknown emails');
  await api('POST', '/api/auth/forgot-password', { body: { email: vol.email } });
  const resetToken = tokenFromEmail(vol.email, '/reset-password');
  assert(Boolean(resetToken), 'Password reset email is sent');
  const weakReset = await api('POST', '/api/auth/reset-password', { body: { token: resetToken, password: 'short' } });
  assert(weakReset.status === 400, 'Weak new password is rejected on reset');
  const reset = await api('POST', '/api/auth/reset-password', { body: { token: resetToken, password: 'Password123!' } });
  assert(reset.status === 200, 'Password reset succeeds');
  const oldSession = await api('GET', '/api/auth/me', { token: volToken });
  assert(oldSession.status === 401 && oldSession.data.code === 'SESSION_REVOKED', 'Password reset revokes existing sessions');
  volLogin = await api('POST', '/api/auth/login', { body: { email: vol.email, password: 'Password123!' } });
  volToken = volLogin.data.data.token;

  const logoutAll = await api('POST', '/api/auth/logout-all', { token: volToken });
  assert(logoutAll.status === 200, 'Logout from all sessions succeeds');
  assert((await api('GET', '/api/auth/me', { token: volToken })).status === 401, 'Logout-all revokes the current token');
  volToken = (await api('POST', '/api/auth/login', { body: { email: vol.email, password: 'Password123!' } })).data.data.token;

  const roleEscalation = await api('POST', '/api/auth/register', {
    body: { full_name: 'Sneaky', email: `sneaky.${stamp}@prodtest.org`, password: 'Password123!', role: 'ADMIN' },
  });
  assert(roleEscalation.status === 400, 'ADMIN role cannot be self-registered');

  // ------------------------------------------------------------------
  section('Admin + organization verification');
  const adminEmail = `admin.${stamp}@prodtest.org`;
  createdUserEmails.push(adminEmail);
  await pool.query(
    "INSERT INTO users (full_name, email, password_hash, role, email_verified_at) VALUES ('Admin Tester', $1, $2, 'ADMIN', NOW())",
    [adminEmail, await bcrypt.hash('Password123!', 10)]
  );
  const adminToken = (await api('POST', '/api/auth/login', { body: { email: adminEmail, password: 'Password123!' } })).data.data.token;

  const coord = await register('coord', 'COORDINATOR');
  const { token: coordToken } = await verifyAndLogin(coord.email);
  const org = await api('POST', '/api/organizations', { token: coordToken, body: { name: `Prod Org ${stamp}`, description: 'Test' } });
  const orgId = org.data.data.organization.id;
  assert(org.data.data.organization.verification_status === 'PENDING', 'New organization starts as PENDING');
  await sleep(50);
  const adminNotified = (await api('GET', '/api/notifications', { token: adminToken })).data.data.notifications.some(
    (n) => n.reference_id === orgId
  );
  assert(adminNotified, 'Admins are notified of new organizations');

  const publicOrgs = await api('GET', `/api/organizations?q=${encodeURIComponent(`Prod Org ${stamp}`)}`);
  assert(publicOrgs.status === 200 && publicOrgs.data.data.organizations.length === 0, 'Pending org is hidden from the public directory');
  const ownOrgs = await api('GET', '/api/organizations/mine', { token: coordToken });
  assert(ownOrgs.data.data.organizations.some((o) => o.id === orgId), 'Coordinator sees own pending org');
  assert((await api('GET', `/api/organizations/${orgId}`)).status === 404, 'Pending org detail is hidden from the public');

  const oppPayload = {
    organization_id: orgId,
    title: `Beach Cleanup ${stamp}`,
    description: 'Help clean the beach',
    category: 'Environment',
    event_date: '2027-06-15',
    start_time: '09:00:00',
    end_time: '12:00:00',
    location: 'Marina Beach',
    capacity: 1,
    status: 'PUBLISHED',
    skills_required: ['Teamwork', 'Outdoor'],
  };
  const blocked = await api('POST', '/api/opportunities', { token: coordToken, body: oppPayload });
  assert(blocked.status === 403 && blocked.data.code === 'ORG_NOT_VERIFIED', 'Unverified org cannot publish');
  const draft = await api('POST', '/api/opportunities', { token: coordToken, body: { ...oppPayload, status: 'DRAFT' } });
  assert(draft.status === 201, 'Unverified org can save a draft');
  const oppId = draft.data.data.opportunity.id;

  assert((await api('GET', '/api/admin/stats', { token: coordToken })).status === 403, 'Non-admin cannot access admin API');
  const pending = await api('GET', '/api/admin/organizations?status=PENDING', { token: adminToken });
  assert(pending.data.data.organizations.some((o) => o.id === orgId), 'Admin sees pending organizations');
  const rejectNoNote = await api('PATCH', `/api/admin/organizations/${orgId}/verification`, {
    token: adminToken,
    body: { status: 'REJECTED' },
  });
  assert(rejectNoNote.status === 400, 'Rejecting requires a note');
  const approve = await api('PATCH', `/api/admin/organizations/${orgId}/verification`, {
    token: adminToken,
    body: { status: 'APPROVED' },
  });
  assert(approve.status === 200 && approve.data.data.organization.verification_status === 'APPROVED', 'Admin approves organization');
  await sleep(50);
  assert(emailService.getOutbox().some((m) => m.to === coord.email && /approved/i.test(m.subject)), 'Coordinator is emailed about approval');
  const logs = await api('GET', '/api/admin/audit-logs', { token: adminToken });
  assert(logs.data.data.logs.some((l) => l.entity_id === orgId), 'Admin action is written to the audit log');

  // ------------------------------------------------------------------
  section('Public browsing, search, drafts, calendar');
  assert((await api('GET', `/api/opportunities/${oppId}`)).status === 404, 'Draft is hidden from the public');
  const publish = await api('PATCH', `/api/opportunities/${oppId}`, { token: coordToken, body: { status: 'PUBLISHED' } });
  assert(publish.status === 200, 'Verified org can publish');

  const publicDetail = await api('GET', `/api/opportunities/${oppId}`);
  assert(publicDetail.status === 200, 'Published opportunity is publicly viewable without login');
  assert(publicDetail.data.data.opportunity.check_in_code === undefined, 'Check-in code is hidden from the public');
  const ownerDetail = await api('GET', `/api/opportunities/${oppId}`, { token: coordToken });
  const checkInCode = ownerDetail.data.data.opportunity.check_in_code;
  assert(typeof checkInCode === 'string' && checkInCode.length === 6, 'Owner sees the check-in code');

  const search = await api('GET', `/api/opportunities?q=${encodeURIComponent(`Beach Cleanup ${stamp}`)}&category=environment&skills=Outdoor&limit=5`);
  assert(
    search.status === 200 && search.data.data.opportunities.length === 1 && search.data.data.pagination.limit === 5,
    'Search with text, category, skills and pagination works'
  );
  const badDate = await api('GET', '/api/opportunities?from_date=15-06-2027');
  assert(badDate.status === 400, 'Invalid date filter is rejected');

  const ics = await api('GET', `/api/opportunities/${oppId}/calendar.ics`, { raw: true });
  const icsBody = await ics.text();
  assert(ics.status === 200 && icsBody.includes('BEGIN:VEVENT') && icsBody.includes('DTSTART;TZID='), 'Calendar (.ics) download works');

  // ------------------------------------------------------------------
  section('Waitlist & automatic promotion');
  const vol2 = await register('vol2', 'VOLUNTEER');
  const { token: vol2Token, user: vol2User } = await verifyAndLogin(vol2.email);

  const early = await api('POST', `/api/opportunities/${oppId}/waitlist`, { token: volToken });
  assert(early.status === 409 && early.data.code === 'SPOTS_AVAILABLE', 'Cannot join waitlist while spots are open');
  const signup1 = await api('POST', `/api/opportunities/${oppId}/signup`, { token: volToken });
  assert(signup1.status === 201, 'Volunteer 1 takes the only spot');
  await sleep(50);
  const confirmMail = emailService.getOutbox().find((m) => m.to === vol.email && m.subject.startsWith("You're registered"));
  assert(Boolean(confirmMail?.attachments?.[0]?.filename === 'event.ics'), 'Signup confirmation email includes a calendar invite');

  const full = await api('POST', `/api/opportunities/${oppId}/signup`, { token: vol2Token });
  assert(full.status === 409, 'Second volunteer is rejected when full');
  const join = await api('POST', `/api/opportunities/${oppId}/waitlist`, { token: vol2Token });
  assert(join.status === 201 && join.data.data.waitlist_entry.position === 1, 'Second volunteer joins waitlist at position 1', JSON.stringify(join.data));
  const myWait = await api('GET', '/api/signups/my/waitlist', { token: vol2Token });
  assert(myWait.data.data.waitlist.some((w) => w.opportunity_id === oppId), 'Volunteer can list own waitlist entries');
  const detailForVol2 = await api('GET', `/api/opportunities/${oppId}`, { token: vol2Token });
  assert(detailForVol2.data.data.opportunity.my_waitlist_position === 1, 'Opportunity detail shows the viewer’s waitlist position');

  const cancel = await api('DELETE', `/api/opportunities/${oppId}/signup`, { token: volToken });
  assert(cancel.status === 200, 'Volunteer 1 cancels');
  const promoted = await pool.query(
    "SELECT status FROM signups WHERE opportunity_id = $1 AND volunteer_id = $2",
    [oppId, vol2User.id]
  );
  assert(promoted.rows[0]?.status === 'REGISTERED', 'Waitlisted volunteer is promoted automatically');
  const waitLeft = await pool.query('SELECT COUNT(*)::int AS n FROM waitlist_entries WHERE opportunity_id = $1', [oppId]);
  assert(waitLeft.rows[0].n === 0, 'Promoted volunteer is removed from the waitlist');
  await sleep(50);
  assert(emailService.getOutbox().some((m) => m.to === vol2.email && /spot opened/i.test(m.subject)), 'Promoted volunteer is emailed');

  const attendees = await api('GET', `/api/opportunities/${oppId}/signups`, { token: coordToken });
  assert(Array.isArray(attendees.data.data.waitlist), 'Attendee list includes the waitlist');

  // ------------------------------------------------------------------
  section('Check-in, attendance, self-logged hours, certificate');
  // Move the event to "now" in the app time zone so the check-in window is open.
  await pool.query(
    `UPDATE opportunities
        SET event_date = (NOW() AT TIME ZONE $2)::date,
            start_time = ((NOW() AT TIME ZONE $2) - INTERVAL '30 minutes')::time,
            end_time = ((NOW() AT TIME ZONE $2) + INTERVAL '30 minutes')::time
      WHERE id = $1`,
    [oppId, process.env.APP_TIMEZONE || 'Asia/Kolkata']
  );
  const wrongCode = await api('POST', `/api/opportunities/${oppId}/check-in`, { token: vol2Token, body: { code: 'WRONG1' } });
  assert(wrongCode.status === 400 && wrongCode.data.code === 'INVALID_CODE', 'Wrong check-in code is rejected');
  const checkIn = await api('POST', `/api/opportunities/${oppId}/check-in`, { token: vol2Token, body: { code: checkInCode.toLowerCase() } });
  assert(checkIn.status === 200 && checkIn.data.data.signup.attendance_status === 'PRESENT', 'Volunteer checks in with the event code');
  const notRegistered = await api('POST', `/api/opportunities/${oppId}/check-in`, { token: volToken, body: { code: checkInCode } });
  assert(notRegistered.status === 404, 'Cancelled volunteer cannot check in');

  const vol2Signup = (await pool.query('SELECT id FROM signups WHERE opportunity_id = $1 AND volunteer_id = $2', [oppId, vol2User.id])).rows[0].id;
  const attendance = await api('PATCH', `/api/signups/${vol2Signup}/attendance`, { token: coordToken, body: { attendance_status: 'ABSENT' } });
  assert(attendance.status === 200 && attendance.data.data.signup.attendance_status === 'ABSENT', 'Coordinator can mark attendance');
  await api('PATCH', `/api/signups/${vol2Signup}/attendance`, { token: coordToken, body: { attendance_status: 'PRESENT' } });

  const tooMany = await api('POST', `/api/signups/${vol2Signup}/hours/self`, { token: vol2Token, body: { hours: 30 } });
  assert(tooMany.status === 400, 'Self-logged hours over 24 are rejected');
  const logged = await api('POST', `/api/signups/${vol2Signup}/hours/self`, { token: vol2Token, body: { hours: 2.5, notes: 'Great day' } });
  assert(logged.status === 201 && logged.data.data.volunteer_hours.status === 'PENDING', 'Volunteer logs own hours as PENDING');
  const dupLog = await api('POST', `/api/signups/${vol2Signup}/hours/self`, { token: vol2Token, body: { hours: 1 } });
  assert(dupLog.status === 409, 'Duplicate hour submission is rejected');
  const otherVolLog = await api('POST', `/api/signups/${vol2Signup}/hours/self`, { token: volToken, body: { hours: 1 } });
  assert(otherVolLog.status === 404, 'Volunteer cannot log hours on someone else’s signup');

  const noCert = await api('GET', '/api/hours/my/certificate', { token: vol2Token });
  assert(noCert.status === 400, 'Certificate requires verified hours');
  const verifyHours = await api('PATCH', `/api/hours/${logged.data.data.volunteer_hours.id}/status`, {
    token: coordToken,
    body: { status: 'VERIFIED' },
  });
  assert(verifyHours.status === 200, 'Coordinator verifies self-logged hours');
  const cert = await api('GET', '/api/hours/my/certificate', { token: vol2Token, raw: true });
  const certBytes = Buffer.from(await cert.arrayBuffer());
  assert(
    cert.status === 200 && cert.headers.get('content-type') === 'application/pdf' && certBytes.slice(0, 4).toString() === '%PDF',
    'Certificate PDF is generated'
  );

  // ------------------------------------------------------------------
  section('Profile validation, suspension, export, deletion');
  const badAvatar = await api('PATCH', '/api/users/profile', { token: vol2Token, body: { avatar_url: 'javascript:alert(1)' } });
  assert(badAvatar.status === 400, 'Unsafe avatar URL is rejected');
  const badSite = await api('PATCH', `/api/organizations/${orgId}`, { token: coordToken, body: { website: 'javascript:alert(1)' } });
  assert(badSite.status === 400, 'Unsafe organization website is rejected');
  const prefs = await api('PATCH', '/api/users/profile', { token: vol2Token, body: { email_notifications: false } });
  assert(prefs.status === 200 && prefs.data.data.user.email_notifications === false, 'Email notification preference can be turned off');

  const suspend = await api('PATCH', `/api/admin/users/${volId}`, { token: adminToken, body: { is_active: false } });
  assert(suspend.status === 200, 'Admin suspends a user');
  assert([401, 403].includes((await api('GET', '/api/auth/me', { token: volToken })).status), 'Suspended user’s sessions are rejected');
  const suspendedLogin = await api('POST', '/api/auth/login', { body: { email: vol.email, password: 'Password123!' } });
  assert(suspendedLogin.status === 403 && suspendedLogin.data.code === 'ACCOUNT_SUSPENDED', 'Suspended user cannot log in');
  await api('PATCH', `/api/admin/users/${volId}`, { token: adminToken, body: { is_active: true } });

  const exportRes = await api('GET', '/api/users/me/export', { token: vol2Token });
  assert(exportRes.status === 200 && exportRes.data.profile?.email === vol2.email && Array.isArray(exportRes.data.signups), 'Personal data export works');

  const coordDelete = await api('DELETE', '/api/users/me', { token: coordToken, body: { password: 'Password123!' } });
  assert(coordDelete.status === 409, 'Coordinator with an organization cannot delete account');
  const wrongPw = await api('DELETE', '/api/users/me', { token: vol2Token, body: { password: 'WrongPass123' } });
  assert(wrongPw.status === 400, 'Account deletion requires the correct password');
  const del = await api('DELETE', '/api/users/me', { token: vol2Token, body: { password: 'Password123!' } });
  assert(del.status === 200, 'Volunteer deletes own account');
  const gone = await pool.query('SELECT 1 FROM users WHERE id = $1', [vol2User.id]);
  assert(gone.rows.length === 0, 'Deleted account is removed from the database');
};

const cleanup = async () => {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = ANY($1)', [createdUserEmails]);
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await pool.query(
        'DELETE FROM volunteer_hours WHERE recorded_by = ANY($1) OR signup_id IN (SELECT id FROM signups WHERE volunteer_id = ANY($1))',
        [ids]
      );
      await pool.query('DELETE FROM organizations WHERE coordinator_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [ids]);
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
};

run()
  .catch((err) => {
    failed++;
    console.error('Unexpected failure:', err);
  })
  .finally(async () => {
    await cleanup();
    if (server) server.close();
    await pool.end();
    console.log(`\n${c.bold}PRODUCTION FEATURES: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
