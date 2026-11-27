/**
 * Overnight events, closing an NGO, and paginated organization hours.
 *
 *  - An event may finish after midnight only when it is marked `ends_next_day`.
 *  - A platform admin can close an NGO: upcoming events are cancelled, waitlists cleared,
 *    the team removed (so the former owner is free), past events kept.
 *  - GET /api/hours/organization supports opt-in ?page=&limit= and ?status=.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_ORG_APPROVAL = 'false';
process.env.REQUIRE_VOLUNTEER_DETAILS = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';

const bcrypt = require('bcrypt');
const app = require('../src/app');
const fetch = require('./helpers/testFetch');
const pool = require('../src/config/db');
const { migrate } = require('../src/db/migrate');
const { getOutbox, clearOutbox } = require('../src/services/emailService');
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
const PASSWORD = 'Password123!';

const api = async (method, path, { token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

const login = async (email) => {
  const res = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  return { email, token: res.data.data?.token, user: res.data.data?.user };
};

const registerAndLogin = async (prefix, role) => {
  const email = `${prefix}.${stamp}@closuretest.org`;
  createdUserEmails.push(email);
  await api('POST', '/api/auth/register', { body: { full_name: `${prefix} Tester`, email, password: PASSWORD, role } });
  return login(email);
};

const createAdmin = async () => {
  const email = `admin.${stamp}@closuretest.org`;
  createdUserEmails.push(email);
  await pool.query(
    "INSERT INTO users (full_name, email, password_hash, role, email_verified_at) VALUES ('Admin Tester', $1, $2, 'ADMIN', NOW())",
    [email, await bcrypt.hash(PASSWORD, 4)]
  );
  return login(email);
};

const dateFromToday = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

const eventBody = (orgId, overrides = {}) => ({
  organization_id: orgId,
  title: 'Closure suite event',
  description: 'Test event',
  category: 'Community',
  event_date: dateFromToday(10),
  start_time: '09:00',
  end_time: '12:00',
  location: 'Town hall',
  capacity: 5,
  status: 'PUBLISHED',
  ...overrides,
});

const run = async () => {
  console.log(`${c.bold}${c.cyan}OVERNIGHT EVENTS, NGO CLOSURE & HOURS PAGINATION SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  const owner = await registerAndLogin('owner', 'COORDINATOR');
  const staff = await registerAndLogin('staff', 'COORDINATOR');
  const vol1 = await registerAndLogin('vol1', 'VOLUNTEER');
  const vol2 = await registerAndLogin('vol2', 'VOLUNTEER');
  const admin = await createAdmin();

  const created = await api('POST', '/api/organizations', {
    token: owner.token,
    body: { name: `Closure NGO ${stamp}`, description: 'Closure test' },
  });
  const org = created.data.data?.organization;
  assert(created.status === 201 && org?.id, 'Owner registers an NGO', JSON.stringify(created.data));
  await organizationMemberRepository.add({ organizationId: org.id, userId: staff.user.id, role: 'COORDINATOR', addedBy: owner.user.id });

  // ------------------------------------------------------------------
  section('Overnight events');
  const typo = await api('POST', '/api/opportunities', { token: owner.token, body: eventBody(org.id, { start_time: '22:00', end_time: '02:00' }) });
  assert(typo.status === 400 && /ending the next day/.test(typo.data.message), 'End before start without ends_next_day is rejected with a hint', JSON.stringify(typo.data));

  const overnight = await api('POST', '/api/opportunities', {
    token: owner.token,
    body: eventBody(org.id, { title: 'Night shelter shift', start_time: '22:00', end_time: '02:00', ends_next_day: true }),
  });
  const overnightOpp = overnight.data.data?.opportunity;
  assert(overnight.status === 201 && overnightOpp?.ends_next_day === true, 'ends_next_day: true allows 22:00–02:00', JSON.stringify(overnight.data));

  const fetched = await api('GET', `/api/opportunities/${overnightOpp?.id}`, { token: vol1.token });
  assert(fetched.data.data?.opportunity?.ends_next_day === true, 'ends_next_day is returned when reading the event');

  const badFlag = await api('POST', '/api/opportunities', {
    token: owner.token,
    body: eventBody(org.id, { start_time: '09:00', end_time: '12:00', ends_next_day: true }),
  });
  assert(badFlag.status === 400, 'ends_next_day with an end after the start is rejected');

  const notBool = await api('POST', '/api/opportunities', { token: owner.token, body: eventBody(org.id, { ends_next_day: 'yes' }) });
  assert(notBool.status === 400, 'ends_next_day must be a boolean');

  const keepOvernight = await api('PATCH', `/api/opportunities/${overnightOpp?.id}`, { token: owner.token, body: { end_time: '03:00' } });
  assert(keepOvernight.status === 200 && keepOvernight.data.data?.opportunity?.ends_next_day === true, 'An overnight event stays overnight when only end_time changes', JSON.stringify(keepOvernight.data));

  const toSameDay = await api('PATCH', `/api/opportunities/${overnightOpp?.id}`, {
    token: owner.token,
    body: { start_time: '18:00', end_time: '21:00', ends_next_day: false },
  });
  assert(toSameDay.status === 200 && toSameDay.data.data?.opportunity?.ends_next_day === false, 'It can be changed back to a same-day event', JSON.stringify(toSameDay.data));

  const sameDayTypo = await api('PATCH', `/api/opportunities/${overnightOpp?.id}`, { token: owner.token, body: { end_time: '17:00' } });
  assert(sameDayTypo.status === 400, 'A same-day event still rejects an end before its start');

  const ics = await fetch(`${baseUrl}/api/opportunities/${overnightOpp?.id}/calendar.ics`);
  assert(ics.status === 200, 'Calendar file still works');

  // ------------------------------------------------------------------
  section('Organization hours pagination');
  const hoursEvent = await api('POST', '/api/opportunities', { token: owner.token, body: eventBody(org.id, { title: 'Hours event', capacity: 10 }) });
  const hoursEventId = hoursEvent.data.data?.opportunity?.id;
  const s1 = await api('POST', `/api/opportunities/${hoursEventId}/signup`, { token: vol1.token });
  const s2 = await api('POST', `/api/opportunities/${hoursEventId}/signup`, { token: vol2.token });
  const signupIds = [s1.data.data?.signup?.id, s2.data.data?.signup?.id];
  assert(signupIds.every(Boolean), 'Two volunteers register', JSON.stringify([s1.data, s2.data]));
  await api('POST', `/api/signups/${signupIds[0]}/hours`, { token: owner.token, body: { hours: 2, status: 'RECORDED' } });
  await api('POST', `/api/signups/${signupIds[1]}/hours`, { token: owner.token, body: { hours: 3, status: 'VERIFIED' } });
  await api('POST', `/api/signups/${signupIds[0]}/hours`, { token: owner.token, body: { hours: 1, status: 'PENDING' } });

  const all = await api('GET', '/api/hours/organization', { token: owner.token });
  assert(all.status === 200 && all.data.data?.hours?.length === 3 && all.data.data.pagination === undefined, 'Without paging params every record comes back, as before');

  const page1 = await api('GET', '/api/hours/organization?page=1&limit=2', { token: owner.token });
  const page2 = await api('GET', '/api/hours/organization?page=2&limit=2', { token: owner.token });
  assert(page1.data.data?.hours?.length === 2 && page1.data.data?.pagination?.total === 3 && page1.data.data.pagination.total_pages === 2, 'Page 1 has 2 records and the total', JSON.stringify(page1.data.data?.pagination));
  assert(page2.data.data?.hours?.length === 1, 'Page 2 has the last record');
  const ids = new Set([...page1.data.data.hours, ...page2.data.data.hours].map((h) => h.id));
  assert(ids.size === 3, 'Pages don’t overlap');

  const past = await api('GET', '/api/hours/organization?page=5&limit=2', { token: owner.token });
  assert(past.data.data?.hours?.length === 0 && past.data.data?.pagination?.total === 3, 'A page past the end is empty but still reports the total');

  const verified = await api('GET', '/api/hours/organization?status=verified', { token: owner.token });
  assert(verified.data.data?.hours?.length === 1 && verified.data.data.hours[0].status === 'VERIFIED', 'status filter works (case-insensitive)');
  const review = await api('GET', '/api/hours/organization?status=PENDING,RECORDED&page=1&limit=10', { token: owner.token });
  assert(
    review.data.data?.hours?.length === 2 && review.data.data.hours.every((h) => ['PENDING', 'RECORDED'].includes(h.status)) && review.data.data.pagination?.total === 2,
    'A comma-separated status list matches any of them',
    JSON.stringify(review.data.data?.pagination)
  );
  const badStatus = await api('GET', '/api/hours/organization?status=nope', { token: owner.token });
  assert(badStatus.status === 400, 'Unknown status is rejected');

  // ------------------------------------------------------------------
  section('Closing an NGO');
  const full = await api('POST', '/api/opportunities', { token: owner.token, body: eventBody(org.id, { title: 'Full event', capacity: 1 }) });
  const fullId = full.data.data?.opportunity?.id;
  await api('POST', `/api/opportunities/${fullId}/signup`, { token: vol1.token });
  const waitlisted = await api('POST', `/api/opportunities/${fullId}/waitlist`, { token: vol2.token });
  assert(waitlisted.status === 201 || waitlisted.status === 200, 'Second volunteer joins the waitlist', JSON.stringify(waitlisted.data));

  const draft = await api('POST', '/api/opportunities', { token: owner.token, body: eventBody(org.id, { title: 'Draft event', status: 'DRAFT' }) });
  const pastEvent = await api('POST', '/api/opportunities', { token: owner.token, body: eventBody(org.id, { title: 'Past event', event_date: dateFromToday(-5) }) });
  const pastId = pastEvent.data.data?.opportunity?.id;

  const notAdmin = await api('POST', `/api/admin/organizations/${org.id}/close`, { token: owner.token, body: { reason: 'x' } });
  assert(notAdmin.status === 403, 'Only platform admins can close an NGO');
  const noReason = await api('POST', `/api/admin/organizations/${org.id}/close`, { token: admin.token, body: {} });
  assert(noReason.status === 400, 'A reason is required');

  clearOutbox();
  const closed = await api('POST', `/api/admin/organizations/${org.id}/close`, { token: admin.token, body: { reason: 'The NGO asked to leave ServeHub' } });
  assert(closed.status === 200 && closed.data.data?.organization?.verification_status === 'CLOSED', 'Admin closes the NGO', JSON.stringify(closed.data));
  assert(Boolean(closed.data.data?.organization?.closed_at), 'closed_at is set');
  assert(closed.data.data?.cancelled_events >= 4, 'Upcoming events are counted as cancelled', JSON.stringify(closed.data.data));

  const { rows: statuses } = await pool.query('SELECT id, status FROM opportunities WHERE organization_id = $1', [org.id]);
  const statusOf = Object.fromEntries(statuses.map((r) => [r.id, r.status]));
  assert(statusOf[fullId] === 'CANCELLED' && statusOf[draft.data.data?.opportunity?.id] === 'CANCELLED', 'Upcoming published and draft events are cancelled');
  assert(statusOf[pastId] === 'PUBLISHED', 'Past events are left alone');

  const { rows: waitRows } = await pool.query('SELECT 1 FROM waitlist_entries WHERE opportunity_id = $1', [fullId]);
  assert(waitRows.length === 0, 'Waitlists of cancelled events are cleared');

  const { rows: hoursRows } = await pool.query('SELECT 1 FROM volunteer_hours WHERE signup_id = ANY($1)', [signupIds]);
  assert(hoursRows.length === 3, 'Recorded hours are kept');

  assert((await organizationMemberRepository.findRole(org.id, owner.user.id)) === null, 'Owner membership is removed');
  assert((await organizationMemberRepository.findRole(org.id, staff.user.id)) === null, 'Coordinator membership is removed');

  await new Promise((resolve) => setTimeout(resolve, 50)); // queued emails are sent on the next tick
  const outbox = getOutbox();
  assert(outbox.some((m) => m.to === vol1.email && /Cancelled/.test(m.subject)), 'Registered volunteers get a cancellation email');
  assert(outbox.some((m) => m.to === owner.email && /closed/.test(m.subject)), 'The former owner is emailed about the closure');

  const publicView = await api('GET', `/api/organizations/${org.id}`);
  assert(publicView.status === 404, 'The closed NGO is hidden from the public');
  const adminList = await api('GET', '/api/admin/organizations?status=CLOSED', { token: admin.token });
  assert(adminList.data.data?.organizations?.some((o) => o.id === org.id), 'Admins can still find it under CLOSED');

  const again = await api('POST', `/api/admin/organizations/${org.id}/close`, { token: admin.token, body: { reason: 'again' } });
  assert(again.status === 409, 'Closing twice is rejected');
  const reopen = await api('PATCH', `/api/admin/organizations/${org.id}/verification`, { token: admin.token, body: { status: 'APPROVED' } });
  assert(reopen.status === 409, 'A closed NGO can’t be approved again');

  const { rows: auditRows } = await pool.query("SELECT 1 FROM audit_logs WHERE action = 'ORGANIZATION_CLOSED' AND entity_id = $1", [org.id]);
  assert(auditRows.length === 1, 'The closure is in the audit log');

  const newNgo = await api('POST', '/api/organizations', { token: owner.token, body: { name: `Closure NGO ${stamp}`, description: 'Fresh start' } });
  assert(newNgo.status === 201, 'The former owner can register a new NGO, even with the same name', JSON.stringify(newNgo.data));
  if (newNgo.data.data?.organization?.id) {
    await pool.query('DELETE FROM organizations WHERE id = $1', [newNgo.data.data.organization.id]);
  }
  const deleted = await api('DELETE', '/api/users/me', { token: owner.token, body: { password: PASSWORD } });
  assert(deleted.status === 200, 'The former owner can delete their account', JSON.stringify(deleted.data));

  // Remove the closed NGO itself (no members point at it any more).
  await pool.query('DELETE FROM organizations WHERE id = $1', [org.id]);
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
    console.log(`\n${c.bold}EVENTS, CLOSURE & HOURS: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
