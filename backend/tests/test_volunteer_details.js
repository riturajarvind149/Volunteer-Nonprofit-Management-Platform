/**
 * Volunteer identity details + admin verification suite.
 * Runs with REQUIRE_VOLUNTEER_DETAILS enabled.
 *
 * Covers: registration blocked until details are complete, profile validation
 * (DOB, phones, ID last-4 only), admin list/verify/flag, verification reset on
 * identity change, flagged volunteers blocked from registering / waitlisting,
 * and the coordinator roster not exposing private details.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_ORG_APPROVAL = 'false';
process.env.REQUIRE_VOLUNTEER_DETAILS = 'true';
process.env.RATE_LIMIT_ENABLED = 'false';

const bcrypt = require('bcrypt');
const app = require('../src/app');
const fetch = require('./helpers/testFetch');
const pool = require('../src/config/db');
const { migrate } = require('../src/db/migrate');

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

let server;
let baseUrl;
const stamp = Date.now();
const createdUserEmails = [];

const api = async (method, path, { token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const registerAndLogin = async (prefix, role) => {
  const email = `${prefix}.${stamp}@detailstest.org`;
  createdUserEmails.push(email);
  await api('POST', '/api/auth/register', { body: { full_name: `${prefix} Tester`, email, password: 'Password123!', role } });
  const login = await api('POST', '/api/auth/login', { body: { email, password: 'Password123!' } });
  return { email, token: login.data.data?.token, user: login.data.data?.user };
};

const COMPLETE_DETAILS = {
  full_name: 'Asha Real Person',
  phone: '+91 98765 43210',
  location: 'Bengaluru',
  date_of_birth: '1998-04-12',
  emergency_contact_name: 'Ravi Kumar',
  emergency_contact_phone: '+91 91234 56789',
  id_type: 'aadhaar',
  id_last4: '1234',
};

const run = async () => {
  console.log(`${c.bold}${c.cyan}VOLUNTEER DETAILS TEST SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  // ------------------------------------------------------------------
  section('Setup');
  const vol = await registerAndLogin('vol', 'VOLUNTEER');
  const coord = await registerAndLogin('coord', 'COORDINATOR');
  assert(Boolean(vol.token && coord.token), 'Volunteer and coordinator can sign in');
  assert(vol.user?.verification_status === 'UNVERIFIED', 'New volunteers start as UNVERIFIED');

  const adminEmail = `admin.${stamp}@detailstest.org`;
  createdUserEmails.push(adminEmail);
  await pool.query(
    "INSERT INTO users (full_name, email, password_hash, role, email_verified_at) VALUES ('Admin Tester', $1, $2, 'ADMIN', NOW())",
    [adminEmail, await bcrypt.hash('Password123!', 10)]
  );
  const adminToken = (await api('POST', '/api/auth/login', { body: { email: adminEmail, password: 'Password123!' } })).data.data
    .token;

  const org = await api('POST', '/api/organizations', { token: coord.token, body: { name: `Details Org ${stamp}`, description: 'Test' } });
  const orgId = org.data.data?.organization?.id;
  const oppPayload = (title, capacity) => ({
    organization_id: orgId,
    title,
    description: 'Test event',
    category: 'Environment',
    event_date: '2027-06-15',
    start_time: '09:00:00',
    end_time: '12:00:00',
    location: 'Cubbon Park',
    capacity,
    status: 'PUBLISHED',
  });
  const opp1 = (await api('POST', '/api/opportunities', { token: coord.token, body: oppPayload(`Details Opp A ${stamp}`, 5) })).data
    .data?.opportunity;
  const opp2 = (await api('POST', '/api/opportunities', { token: coord.token, body: oppPayload(`Details Opp B ${stamp}`, 5) })).data
    .data?.opportunity;
  assert(Boolean(opp1?.id && opp2?.id), 'Coordinator publishes two opportunities');

  // ------------------------------------------------------------------
  section('Registration is blocked until details are complete');
  const blocked = await api('POST', `/api/opportunities/${opp1.id}/signup`, { token: vol.token });
  assert(blocked.status === 400 && blocked.data.code === 'PROFILE_INCOMPLETE', 'Incomplete volunteer gets 400 PROFILE_INCOMPLETE', JSON.stringify(blocked.data));
  const blockedWait = await api('POST', `/api/opportunities/${opp1.id}/waitlist`, { token: vol.token });
  assert(blockedWait.status === 400 && blockedWait.data.code === 'PROFILE_INCOMPLETE', 'Incomplete volunteer cannot join a waitlist');

  // ------------------------------------------------------------------
  section('Profile validation');
  const patch = (body) => api('PATCH', '/api/users/profile', { token: vol.token, body });
  assert((await patch({ id_type: 'AADHAAR', id_last4: '123456789012' })).status === 400, 'Full ID numbers are rejected (only last 4 stored)');
  assert((await patch({ id_type: 'AADHAAR' })).status === 400, 'ID type without last 4 is rejected');
  assert((await patch({ id_type: 'CREDIT_CARD', id_last4: '1234' })).status === 400, 'Unknown ID type is rejected');
  assert((await patch({ date_of_birth: '2001-02-30' })).status === 400, 'Impossible date of birth is rejected');
  assert((await patch({ date_of_birth: '2099-01-01' })).status === 400, 'Future date of birth is rejected');
  assert((await patch({ emergency_contact_phone: 'call me' })).status === 400, 'Invalid emergency phone is rejected');

  const saved = await patch(COMPLETE_DETAILS);
  const savedUser = saved.data.data?.user;
  assert(saved.status === 200, 'Complete details are saved', JSON.stringify(saved.data));
  assert(savedUser?.date_of_birth === '1998-04-12', 'Date of birth round-trips as YYYY-MM-DD', savedUser?.date_of_birth);
  assert(savedUser?.id_type === 'AADHAAR' && savedUser?.id_last4 === '1234', 'ID type is normalised and last 4 stored');
  assert(Boolean(savedUser?.details_updated_at), 'details_updated_at is set');

  // ------------------------------------------------------------------
  section('One-click registration once details are complete');
  const ok = await api('POST', `/api/opportunities/${opp1.id}/signup`, { token: vol.token });
  assert(ok.status === 201, 'Volunteer with complete details registers', JSON.stringify(ok.data));

  const roster = await api('GET', `/api/opportunities/${opp1.id}/signups`, { token: coord.token });
  const rosterJson = JSON.stringify(roster.data);
  assert(roster.status === 200 && rosterJson.includes('+91 98765 43210'), 'Coordinator roster shows the volunteer phone');
  assert(!rosterJson.includes('1998-04-12') && !rosterJson.includes('Ravi Kumar') && !rosterJson.includes('id_last4'), 'Coordinator roster does not expose DOB, emergency contact or ID');

  // ------------------------------------------------------------------
  section('Admin review');
  assert((await api('GET', '/api/admin/users?role=VOLUNTEER', { token: vol.token })).status === 403, 'Non-admins cannot list users');
  const list = await api('GET', `/api/admin/users?role=VOLUNTEER&verification=UNVERIFIED&q=${encodeURIComponent(vol.email)}`, { token: adminToken });
  const listed = list.data.data?.users?.[0];
  assert(listed?.id === vol.user.id && listed?.date_of_birth === '1998-04-12' && listed?.emergency_contact_name === 'Ravi Kumar', 'Admin sees the volunteer details');
  assert(Array.isArray(listed?.missing_details) && listed.missing_details.length === 0, 'Admin list reports no missing details');
  assert((await api('GET', '/api/admin/users?verification=BOGUS', { token: adminToken })).status === 400, 'Invalid verification filter is rejected');

  const verifyPath = `/api/admin/users/${vol.user.id}/verification`;
  assert((await api('PATCH', verifyPath, { token: vol.token, body: { status: 'VERIFIED' } })).status === 403, 'Volunteers cannot verify themselves');
  const coordId = (await pool.query('SELECT id FROM users WHERE email = $1', [coord.email])).rows[0].id;
  assert(
    (await api('PATCH', `/api/admin/users/${coordId}/verification`, { token: adminToken, body: { status: 'VERIFIED' } })).status === 400,
    'Only volunteers can be verified'
  );

  const verified = await api('PATCH', verifyPath, { token: adminToken, body: { status: 'verified' } });
  assert(verified.status === 200 && verified.data.data?.user?.verification_status === 'VERIFIED', 'Admin verifies the volunteer', JSON.stringify(verified.data));
  const auditRow = await pool.query("SELECT 1 FROM audit_logs WHERE entity_id = $1 AND action = 'VOLUNTEER_VERIFIED'", [vol.user.id]);
  assert(auditRow.rows.length === 1, 'Verification is written to the audit log');

  const changed = await patch({ phone: '+91 90000 11111' });
  assert(changed.data.data?.user?.verification_status === 'UNVERIFIED', 'Changing identity details resets verification');
  const bioOnly = await api('PATCH', verifyPath, { token: adminToken, body: { status: 'VERIFIED' } });
  await patch({ bio: 'I like trees' });
  const afterBio = await api('GET', '/api/users/profile', { token: vol.token });
  assert(bioOnly.status === 200 && afterBio.data.data?.user?.verification_status === 'VERIFIED', 'Non-identity edits (bio) keep verification');

  // ------------------------------------------------------------------
  section('Flagged volunteers');
  assert((await api('PATCH', verifyPath, { token: adminToken, body: { status: 'FLAGGED' } })).status === 400, 'Flagging requires a note');
  const flagged = await api('PATCH', verifyPath, { token: adminToken, body: { status: 'FLAGGED', note: 'Phone number does not answer' } });
  assert(flagged.data.data?.user?.verification_status === 'FLAGGED', 'Admin flags the volunteer');
  const flaggedSignup = await api('POST', `/api/opportunities/${opp2.id}/signup`, { token: vol.token });
  assert(flaggedSignup.status === 403 && flaggedSignup.data.code === 'VOLUNTEER_FLAGGED', 'Flagged volunteer cannot register');
  const flaggedWait = await api('POST', `/api/opportunities/${opp2.id}/waitlist`, { token: vol.token });
  assert(flaggedWait.status === 403, 'Flagged volunteer cannot join a waitlist');
  const existing = await pool.query("SELECT status FROM signups WHERE volunteer_id = $1 AND opportunity_id = $2", [vol.user.id, opp1.id]);
  assert(existing.rows[0]?.status === 'REGISTERED', 'Existing registrations are kept when flagged');

  const unflag = await api('PATCH', verifyPath, { token: adminToken, body: { status: 'UNVERIFIED' } });
  assert(unflag.status === 200, 'Admin can clear the flag');
  assert((await api('POST', `/api/opportunities/${opp2.id}/signup`, { token: vol.token })).status === 201, 'Unflagged volunteer can register again');

  // A volunteer who never completed details cannot be marked verified.
  const vol2 = await registerAndLogin('vol2', 'VOLUNTEER');
  const vol2Verify = await api('PATCH', `/api/admin/users/${vol2.user.id}/verification`, { token: adminToken, body: { status: 'VERIFIED' } });
  assert(vol2Verify.status === 400, 'Incomplete volunteers cannot be verified');
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
      await pool.query('DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id = ANY($1))', [ids]);
      await pool.query('DELETE FROM audit_logs WHERE actor_id = ANY($1) OR entity_id = ANY($1)', [ids]);
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
    console.log(`\n${c.bold}VOLUNTEER DETAILS: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
