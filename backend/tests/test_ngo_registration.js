/**
 * NGO registration suite (real endpoints, verification and approval switched on).
 *
 * Covers: public NGO sign-up creating the NGO admin + NGO + owner membership together,
 * validation, duplicate email / NGO name, nothing saved on failure, email verification
 * by code, admin notification and review details, publishing locked until approval,
 * signed-in coordinators registering an NGO, one NGO per account, and coordinator
 * sign-up being closed.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
process.env.REQUIRE_ORG_APPROVAL = 'true';
process.env.REQUIRE_VOLUNTEER_DETAILS = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';

const bcrypt = require('bcrypt');
const app = require('../src/app');
const pool = require('../src/config/db');
const { migrate } = require('../src/db/migrate');
const emailService = require('../src/services/emailService');
const fetch = require('./helpers/testFetch');

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
const emails = [];
const email = (prefix) => {
  const e = `${prefix}.${stamp}@ngotest.org`;
  emails.push(e);
  return e;
};

const api = async (method, path, { token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const ngo = (overrides = {}) => ({
  name: `Riverside Trust ${stamp}`,
  description: 'Keeping the riverbank clean',
  registration_type: 'TRUST',
  registration_number: 'MH/2024/0012345',
  city: 'Pune',
  website: 'https://riverside.example.org',
  ...overrides,
});

const signup = (overrides = {}, organization = ngo()) =>
  api('POST', '/api/auth/register-organization', {
    body: { full_name: 'Asha Rao', email: email('ngoadmin'), phone: '+91 98765 43210', password: 'Password123!', organization, ...overrides },
  });

const codeFor = (to) => [...emailService.getOutbox()].reverse().find((m) => m.to === to && m.code)?.code;

const run = async () => {
  console.log(`${c.bold}${c.cyan}NGO REGISTRATION TEST SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  // A platform admin to receive the review notification and approve.
  const adminEmail = email('admin');
  const adminHash = await bcrypt.hash('Password123!', 4);
  const adminId = (await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, email_verified_at) VALUES ('NGO Test Admin', $1, $2, 'ADMIN', NOW()) RETURNING id`,
    [adminEmail, adminHash]
  )).rows[0].id;
  const adminToken = (await api('POST', '/api/auth/login', { body: { email: adminEmail, password: 'Password123!' } })).data.data?.token;

  // ------------------------------------------------------------------
  section('Public NGO sign-up');
  const repEmail = email('rep');
  const created = await signup({ email: repEmail });
  const org = created.data.data?.organization;
  const rep = created.data.data?.user;
  assert(created.status === 201, 'Registering an NGO returns 201', JSON.stringify(created.data));
  assert(rep?.role === 'COORDINATOR' && rep?.phone === '+91 98765 43210', 'The NGO admin account is created with their phone');
  assert(
    org?.verification_status === 'PENDING' && org?.my_role === 'OWNER' &&
      org?.registration_type === 'TRUST' && org?.registration_number === 'MH/2024/0012345' && org?.city === 'Pune',
    'The NGO is pending verification with its registration details, and the person is its owner'
  );
  const owner = await pool.query("SELECT user_id FROM organization_members WHERE organization_id = $1 AND role = 'OWNER'", [org.id]);
  assert(owner.rows[0]?.user_id === rep.id, 'Owner membership is stored');
  assert(created.data.data?.requires_email_verification === true && /^\d{6}$/.test(codeFor(repEmail) || ''), 'A 6-digit verification code is emailed');

  const adminNote = await pool.query("SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'ORG_REVIEW' AND reference_id = $2", [adminId, org.id]);
  assert(adminNote.rows.length === 1, 'Platform admins are notified that the NGO awaits review');

  const blocked = await api('POST', '/api/auth/login', { body: { email: repEmail, password: 'Password123!' } });
  assert(blocked.status === 403 && blocked.data.code === 'EMAIL_NOT_VERIFIED', 'Sign-in waits for email verification');
  const verified = await api('POST', '/api/auth/verify-email', { body: { email: repEmail, code: codeFor(repEmail) } });
  assert(verified.status === 200, 'The code verifies the email');
  const login = await api('POST', '/api/auth/login', { body: { email: repEmail, password: 'Password123!' } });
  const repToken = login.data.data?.token;
  assert(login.status === 200, 'The NGO admin can sign in after verifying');

  const mine = await api('GET', '/api/organizations/mine', { token: repToken });
  assert(mine.data.data?.organizations?.some((o) => o.id === org.id && o.my_role === 'OWNER'), 'The NGO appears under My organizations');

  // ------------------------------------------------------------------
  section('Publishing waits for admin approval');
  const event = (status) => ({
    organization_id: org.id, title: 'Riverbank cleanup', description: 'Bring gloves', category: 'Environment',
    event_date: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), start_time: '09:00', end_time: '11:00',
    location: 'Riverside', capacity: 5, status,
  });
  const early = await api('POST', '/api/opportunities', { token: repToken, body: event('PUBLISHED') });
  assert(early.status === 403 && early.data.code === 'ORG_NOT_VERIFIED', 'Publishing before approval is refused');
  const draft = await api('POST', '/api/opportunities', { token: repToken, body: event('DRAFT') });
  assert(draft.status === 201, 'Drafts can be prepared while pending');

  const adminList = await api('GET', `/api/admin/organizations?q=${encodeURIComponent(org.name)}`, { token: adminToken });
  const listed = adminList.data.data?.organizations?.[0];
  assert(
    listed?.registration_number === 'MH/2024/0012345' && listed?.city === 'Pune' && listed?.owner_phone === '+91 98765 43210' && listed?.owner_email === repEmail,
    'The admin review shows registration details and the NGO admin’s contact'
  );
  const approve = await api('PATCH', `/api/admin/organizations/${org.id}/verification`, { token: adminToken, body: { status: 'APPROVED' } });
  assert(approve.status === 200, 'The admin approves the NGO');
  const published = await api('POST', '/api/opportunities', { token: repToken, body: event('PUBLISHED') });
  assert(published.status === 201, 'Publishing works once approved');

  // ------------------------------------------------------------------
  section('Validation and duplicates (nothing is saved on failure)');
  const missingType = await signup({}, ngo({ name: `Typeless ${stamp}`, registration_type: undefined }));
  assert(missingType.status === 400 && /type of NGO/i.test(missingType.data.message), 'Type of NGO is required');
  const missingCity = await signup({}, ngo({ name: `Cityless ${stamp}`, city: '' }));
  assert(missingCity.status === 400 && /city/i.test(missingCity.data.message), 'City is required');
  const badPhone = await signup({ phone: 'call me' }, ngo({ name: `Phoneless ${stamp}` }));
  assert(badPhone.status === 400 && /phone/i.test(badPhone.data.message), 'A valid phone number is required');
  const badSite = await signup({}, ngo({ name: `Siteless ${stamp}`, website: 'javascript:alert(1)' }));
  assert(badSite.status === 400 && /website/i.test(badSite.data.message), 'Unsafe website addresses are rejected');
  const weak = await signup({ password: 'short' }, ngo({ name: `Weak ${stamp}` }));
  assert(weak.status === 400, 'Weak passwords are rejected');
  const nonText = await signup({}, ngo({ name: `NonText ${stamp}`, description: 42 }));
  assert(nonText.status === 400 && /must be text/.test(nonText.data.message), 'Non-text fields are rejected');

  const dupName = await signup({}, ngo({ name: `  riverside TRUST ${stamp} ` }));
  assert(dupName.status === 409 && dupName.data.code === 'ORG_NAME_TAKEN', 'An NGO name already registered (any letter case) is refused');
  const dupEmail = await signup({ email: repEmail }, ngo({ name: `Another NGO ${stamp}` }));
  assert(dupEmail.status === 409, 'An email that is already registered is refused');
  const leftovers = await pool.query('SELECT COUNT(*)::int AS n FROM organizations WHERE name = ANY($1)', [[
    `Typeless ${stamp}`, `Cityless ${stamp}`, `Phoneless ${stamp}`, `Siteless ${stamp}`, `Weak ${stamp}`, `NonText ${stamp}`, `Another NGO ${stamp}`,
  ]]);
  assert(leftovers.rows[0].n === 0, 'No NGO is saved when registration fails');

  // ------------------------------------------------------------------
  section('Signed-in coordinators and closed coordinator sign-up');
  // The real endpoint (the test helper would create the account directly).
  const closedRes = await globalThis.fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Would-be Coordinator', email: email('closed'), password: 'Password123!', role: 'COORDINATOR' }),
  });
  const closed = await closedRes.json();
  assert(closedRes.status === 400 && closed.code === 'COORDINATOR_SIGNUP_CLOSED', 'Public coordinator sign-up is closed');

  // A coordinator account that isn't part of any NGO (e.g. created before this change).
  const loneEmail = email('lone');
  await api('POST', '/api/auth/register', { body: { full_name: 'Lone Coordinator', email: loneEmail, password: 'Password123!', role: 'COORDINATOR' } });
  const loneToken = (await api('POST', '/api/auth/login', { body: { email: loneEmail, password: 'Password123!' } })).data.data?.token;
  const own = await api('POST', '/api/organizations', { token: loneToken, body: ngo({ name: `Lone NGO ${stamp}`, registration_type: 'SOCIETY' }) });
  assert(own.status === 201 && own.data.data?.organization?.my_role === 'OWNER', 'A signed-in coordinator without an NGO can register one');
  const second = await api('POST', '/api/organizations', { token: loneToken, body: ngo({ name: `Second NGO ${stamp}` }) });
  assert(second.status === 409 && second.data.code === 'ALREADY_OWNS_ORGANIZATION', 'Each account can register one NGO');
  const ownerAgain = await api('POST', '/api/organizations', { token: repToken, body: ngo({ name: `Third NGO ${stamp}` }) });
  assert(ownerAgain.status === 409, 'An NGO admin cannot register a second NGO either');

  const volEmail = email('vol');
  await api('POST', '/api/auth/register', { body: { full_name: 'Some Volunteer', email: volEmail, password: 'Password123!' } });
  await pool.query('UPDATE users SET email_verified_at = NOW() WHERE email = $1', [volEmail]);
  const volToken = (await api('POST', '/api/auth/login', { body: { email: volEmail, password: 'Password123!' } })).data.data?.token;
  assert((await api('POST', '/api/organizations', { token: volToken, body: ngo({ name: `Volunteer NGO ${stamp}` }) })).status === 403, 'Volunteers cannot register an NGO from their account');
};

const cleanup = async () => {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = ANY($1)', [emails]);
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await pool.query(
        'DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id = ANY($1))',
        [ids]
      );
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
    console.log(`\n${c.bold}NGO REGISTRATION: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
