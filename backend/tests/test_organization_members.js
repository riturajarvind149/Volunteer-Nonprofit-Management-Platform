/**
 * Organization membership suite.
 *
 * Access to an organization comes from organization_members, not from a single
 * coordinator column: the creator is its OWNER, and the NGO can appoint
 * COORDINATORs who manage events, rosters and hours but not the NGO profile.
 * Coordinators outside the organization have no access.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_ORG_APPROVAL = 'false';
process.env.REQUIRE_VOLUNTEER_DETAILS = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';

const app = require('../src/app');
const fetch = require('./helpers/testFetch');
const pool = require('../src/config/db');
const { migrate } = require('../src/db/migrate');
const organizationMemberRepository = require('../src/repositories/organizationMemberRepository');

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
  const email = `${prefix}.${stamp}@memberstest.org`;
  createdUserEmails.push(email);
  await api('POST', '/api/auth/register', { body: { full_name: `${prefix} Tester`, email, password: 'Password123!', role } });
  const login = await api('POST', '/api/auth/login', { body: { email, password: 'Password123!' } });
  return { email, token: login.data.data?.token, user: login.data.data?.user };
};

const futureDate = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

const run = async () => {
  console.log(`${c.bold}${c.cyan}ORGANIZATION MEMBERSHIP TEST SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  const owner = await registerAndLogin('owner', 'COORDINATOR');
  const staff = await registerAndLogin('staff', 'COORDINATOR');
  const outsider = await registerAndLogin('outsider', 'COORDINATOR');
  const volunteer = await registerAndLogin('vol', 'VOLUNTEER');

  // ------------------------------------------------------------------
  section('Creating an organization makes the creator its owner');
  const created = await api('POST', '/api/organizations', { token: owner.token, body: { name: `Members NGO ${stamp}`, description: 'Membership test' } });
  const org = created.data.data?.organization;
  assert(created.status === 201 && org?.my_role === 'OWNER', 'Creator gets my_role OWNER in the response', JSON.stringify(created.data));
  assert(org && org.coordinator_id === undefined, 'Responses no longer expose the legacy coordinator_id');
  assert((await organizationMemberRepository.findRole(org.id, owner.user.id)) === 'OWNER', 'Owner membership row is stored');

  const ownerMine = await api('GET', '/api/organizations/mine', { token: owner.token });
  assert(ownerMine.data.data?.organizations?.some((o) => o.id === org.id && o.my_role === 'OWNER'), '/organizations/mine lists it with my_role OWNER');

  const outsiderView = await api('GET', `/api/organizations/${org.id}`, { token: outsider.token });
  assert(outsiderView.status === 200 && outsiderView.data.data?.organization?.my_role === null, 'Non-members see my_role null');

  // ------------------------------------------------------------------
  section('An appointed coordinator manages events, rosters and hours');
  await organizationMemberRepository.add({ organizationId: org.id, userId: staff.user.id, role: 'COORDINATOR', addedBy: owner.user.id });

  const staffMine = await api('GET', '/api/organizations/mine', { token: staff.token });
  assert(staffMine.data.data?.organizations?.some((o) => o.id === org.id && o.my_role === 'COORDINATOR'), 'Coordinator sees the organization with my_role COORDINATOR');

  const opp = await api('POST', '/api/opportunities', {
    token: staff.token,
    body: {
      organization_id: org.id,
      title: 'Members test event',
      description: 'Created by an appointed coordinator',
      category: 'Environment',
      event_date: futureDate(10),
      start_time: '09:00',
      end_time: '12:00',
      location: 'Riverside',
      capacity: 5,
      status: 'PUBLISHED',
    },
  });
  const oppId = opp.data.data?.opportunity?.id;
  assert(opp.status === 201 && oppId, 'Coordinator can create an opportunity for the organization', JSON.stringify(opp.data));

  const staffOpp = await api('GET', `/api/opportunities/${oppId}`, { token: staff.token });
  assert(staffOpp.data.data?.opportunity?.can_manage === true && Boolean(staffOpp.data.data.opportunity.check_in_code), 'Coordinator gets can_manage and the check-in code');
  const ownerOpp = await api('GET', `/api/opportunities/${oppId}`, { token: owner.token });
  assert(ownerOpp.data.data?.opportunity?.can_manage === true, 'Owner can manage the coordinator’s opportunity too');
  const outsiderOpp = await api('GET', `/api/opportunities/${oppId}`, { token: outsider.token });
  assert(outsiderOpp.data.data?.opportunity?.can_manage === false && !outsiderOpp.data.data.opportunity.check_in_code, 'Outsiders get can_manage false and no check-in code');

  const edited = await api('PATCH', `/api/opportunities/${oppId}`, { token: owner.token, body: { location: 'Riverside Park' } });
  assert(edited.status === 200, 'Owner can edit an opportunity a coordinator created');

  const signup = await api('POST', `/api/opportunities/${oppId}/signup`, { token: volunteer.token });
  const signupId = signup.data.data?.signup?.id;
  assert(signup.status === 201, 'Volunteer registers for the event', JSON.stringify(signup.data));

  const notes = await pool.query(
    "SELECT user_id FROM notifications WHERE type = 'REGISTRATION' AND reference_id = $1 AND user_id = ANY($2)",
    [oppId, [owner.user.id, staff.user.id]]
  );
  const notified = new Set(notes.rows.map((r) => r.user_id));
  assert(notified.has(owner.user.id) && notified.has(staff.user.id), 'Both members are notified of the new registration');

  const roster = await api('GET', `/api/opportunities/${oppId}/signups`, { token: staff.token });
  assert(roster.status === 200 && roster.data.data?.attendees?.length === 1, 'Coordinator can open the roster');
  const attendance = await api('PATCH', `/api/signups/${signupId}/attendance`, { token: staff.token, body: { attendance_status: 'PRESENT' } });
  assert(attendance.status === 200, 'Coordinator can mark attendance');
  const hours = await api('POST', `/api/signups/${signupId}/hours`, { token: staff.token, body: { hours: 3, status: 'RECORDED' } });
  const hoursId = hours.data.data?.volunteer_hours?.id;
  assert(hours.status === 201 && hoursId, 'Coordinator can record hours', JSON.stringify(hours.data));
  const verify = await api('PATCH', `/api/hours/${hoursId}/status`, { token: owner.token, body: { status: 'VERIFIED' } });
  assert(verify.status === 200, 'Owner can verify hours a coordinator recorded');

  const orgHours = await api('GET', '/api/hours/organization', { token: staff.token });
  assert(orgHours.data.data?.volunteer_hours?.some((h) => h.id === hoursId), 'Coordinator sees the organization’s hours');
  const analytics = await api('GET', '/api/analytics/coordinator', { token: staff.token });
  assert(analytics.status === 200 && analytics.data.data?.metrics?.total_hours >= 3, 'Coordinator analytics include the organization');
  const report = await api('GET', '/api/reports/volunteer-hours', { token: staff.token });
  assert(report.data.data?.report?.some((r) => r.hour_record_id === hoursId), 'Coordinator reports include the organization');

  // ------------------------------------------------------------------
  section('Only the owner edits the organization profile');
  const staffEdit = await api('PATCH', `/api/organizations/${org.id}`, { token: staff.token, body: { description: 'Changed by staff' } });
  assert(staffEdit.status === 403, 'Coordinator cannot edit the organization profile (403)');
  const ownerEdit = await api('PATCH', `/api/organizations/${org.id}`, { token: owner.token, body: { description: 'Changed by the owner' } });
  assert(ownerEdit.status === 200 && ownerEdit.data.data?.organization?.my_role === 'OWNER', 'Owner can edit it');

  // ------------------------------------------------------------------
  section('Coordinators outside the organization have no access');
  const outsiderCreate = await api('POST', '/api/opportunities', {
    token: outsider.token,
    body: { organization_id: org.id, title: 'Intruder event', category: 'Environment', event_date: futureDate(12), start_time: '09:00', end_time: '10:00', location: 'X', capacity: 2 },
  });
  assert(outsiderCreate.status === 403, 'Cannot create opportunities for it (403)');
  assert((await api('PATCH', `/api/opportunities/${oppId}`, { token: outsider.token, body: { location: 'Elsewhere' } })).status === 403, 'Cannot edit its opportunities (403)');
  assert((await api('GET', `/api/opportunities/${oppId}/signups`, { token: outsider.token })).status === 403, 'Cannot open its roster (403)');
  assert((await api('PATCH', `/api/signups/${signupId}/attendance`, { token: outsider.token, body: { attendance_status: 'ABSENT' } })).status === 403, 'Cannot mark attendance (403)');
  assert((await api('PATCH', `/api/hours/${hoursId}/status`, { token: outsider.token, body: { status: 'RECORDED' } })).status === 403, 'Cannot change hours (403)');
  const outsiderHours = await api('GET', '/api/hours/organization', { token: outsider.token });
  assert(!outsiderHours.data.data?.volunteer_hours?.some((h) => h.id === hoursId), 'Does not see its hours');

  // ------------------------------------------------------------------
  section('Account deletion');
  const staffDelete = await api('DELETE', '/api/users/me', { token: staff.token, body: { password: 'Password123!' } });
  assert(staffDelete.status === 200, 'A coordinator can delete their account', JSON.stringify(staffDelete.data));
  assert((await organizationMemberRepository.findRole(org.id, staff.user.id)) === null, 'Their membership is removed with the account');
  const ownerDelete = await api('DELETE', '/api/users/me', { token: owner.token, body: { password: 'Password123!' } });
  assert(ownerDelete.status === 409, 'The owner must hand over the organization first (409)');
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
      await pool.query(
        'DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id = ANY($1))',
        [ids]
      );
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
    console.log(`\n${c.bold}ORGANIZATION MEMBERS: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
