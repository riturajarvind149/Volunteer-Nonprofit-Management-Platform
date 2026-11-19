/**
 * NGO team suite: invitations, accepting, removing, leaving and handing over the NGO admin role.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.REQUIRE_ORG_APPROVAL = 'false';
process.env.REQUIRE_VOLUNTEER_DETAILS = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';

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
  const e = `${prefix}.${stamp}@teamtest.org`;
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

const account = async (prefix, role) => {
  const address = email(prefix);
  await api('POST', '/api/auth/register', { body: { full_name: `${prefix} Tester`, email: address, password: 'Password123!', role } });
  const login = await api('POST', '/api/auth/login', { body: { email: address, password: 'Password123!' } });
  return { email: address, token: login.data.data?.token, user: login.data.data?.user };
};

/** The invitation token from the latest invitation email to an address. */
const inviteTokenFor = (to) => {
  const mail = [...emailService.getOutbox()].reverse().find((m) => m.to === to && m.cta?.url.includes('/invitations/accept'));
  return mail ? new URL(mail.cta.url).searchParams.get('token') : null;
};

const roleOf = async (orgId, userId) =>
  (await pool.query('SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2', [orgId, userId])).rows[0]?.role || null;

const run = async () => {
  console.log(`${c.bold}${c.cyan}NGO TEAM TEST SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  const owner = await account('owner', 'COORDINATOR');
  const outsider = await account('outsider', 'COORDINATOR');
  const volunteer = await account('vol', 'VOLUNTEER');
  const org = (await api('POST', '/api/organizations', { token: owner.token, body: { name: `Team NGO ${stamp}`, registration_type: 'TRUST', city: 'Pune' } })).data.data.organization;

  // ------------------------------------------------------------------
  section('Inviting');
  const newcomerEmail = email('newcomer');
  const invite = await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: newcomerEmail.toUpperCase() } });
  assert(invite.status === 201 && invite.data.data?.email_sent === true && invite.data.data.invitation.email === newcomerEmail, 'The NGO admin invites an email (stored lower-case) and it is emailed', JSON.stringify(invite.data));
  const firstToken = inviteTokenFor(newcomerEmail);
  assert(Boolean(firstToken), 'The invitation email contains an accept link');

  const team = await api('GET', `/api/organizations/${org.id}/team`, { token: owner.token });
  assert(team.status === 200 && team.data.data.members.length === 1 && team.data.data.invitations.some((i) => i.email === newcomerEmail), 'The team page lists members and the pending invitation');
  assert(team.data.data.members[0].email_notifications === undefined, 'Member entries don’t expose notification settings');

  assert((await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: 'not-an-email' } })).status === 400, 'An invalid email is rejected');
  const volInvite = await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: volunteer.email } });
  assert(volInvite.status === 409 && volInvite.data.code === 'EMAIL_NOT_INVITABLE', 'A volunteer account’s email can’t be invited');
  const selfInvite = await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: owner.email } });
  assert(selfInvite.status === 409 && selfInvite.data.code === 'ALREADY_MEMBER', 'Existing members can’t be invited again');
  assert((await api('GET', `/api/organizations/${org.id}/team`, { token: outsider.token })).status === 404, 'Outsiders can’t see the team (404)');
  assert((await api('POST', `/api/organizations/${org.id}/invitations`, { token: outsider.token, body: { email: email('x') } })).status === 404, 'Outsiders can’t invite');

  // Re-inviting replaces the earlier link.
  await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: newcomerEmail } });
  const secondToken = inviteTokenFor(newcomerEmail);
  assert(secondToken && secondToken !== firstToken, 'Re-inviting sends a new link');
  assert((await api('POST', '/api/invitations/preview', { body: { token: firstToken } })).status === 400, 'The earlier link stops working');
  const openAfterResend = (await api('GET', `/api/organizations/${org.id}/team`, { token: owner.token })).data.data.invitations.filter((i) => i.email === newcomerEmail);
  assert(openAfterResend.length === 1, 'Only one invitation stays open per email');

  // ------------------------------------------------------------------
  section('Accepting as a new coordinator');
  const preview = await api('POST', '/api/invitations/preview', { body: { token: secondToken } });
  assert(
    preview.status === 200 && preview.data.data.invitation.organization_name === org.name &&
      preview.data.data.invitation.invited_by_name === 'owner Tester' && preview.data.data.invitation.account_exists === false,
    'The preview shows the NGO, who invited them and that no account exists yet'
  );
  assert((await api('POST', '/api/invitations/accept', { body: { token: secondToken, full_name: 'N', password: 'Password123!' } })).status === 400, 'A name is required');
  assert((await api('POST', '/api/invitations/accept', { body: { token: secondToken, full_name: 'Neha New', password: 'short' } })).status === 400, 'A strong password is required');
  const accepted = await api('POST', '/api/invitations/accept', { body: { token: secondToken, full_name: 'Neha New', password: 'Password123!' } });
  const newcomer = accepted.data.data?.user;
  assert(accepted.status === 200 && accepted.data.data?.token && newcomer?.role === 'COORDINATOR' && newcomer?.email_verified_at, 'Accepting creates a verified coordinator account and signs them in', JSON.stringify(accepted.data));
  assert(newcomer && newcomer.password_hash === undefined && newcomer.token_version === undefined, 'No secrets are returned');
  assert((await roleOf(org.id, newcomer.id)) === 'COORDINATOR', 'They are a coordinator of the NGO');
  const me = await api('GET', '/api/auth/me', { token: accepted.data.data.token });
  assert(me.status === 200, 'The returned session works');
  assert((await api('POST', '/api/invitations/accept', { body: { token: secondToken, full_name: 'Again', password: 'Password123!' } })).status === 400, 'An invitation can only be used once');
  const joinedNote = await pool.query("SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'TEAM' AND reference_id = $2", [owner.user.id, org.id]);
  assert(joinedNote.rows.length >= 1, 'The NGO admin is notified that they joined');
  const newcomerToken = accepted.data.data.token;

  // ------------------------------------------------------------------
  section('Accepting with an existing coordinator account');
  await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: outsider.email } });
  const outsiderInvite = inviteTokenFor(outsider.email);
  const outsiderPreview = await api('POST', '/api/invitations/preview', { body: { token: outsiderInvite } });
  assert(outsiderPreview.data.data.invitation.account_exists === true && outsiderPreview.data.data.invitation.account_can_accept === true, 'The preview says the account exists and can accept');
  const anonymous = await api('POST', '/api/invitations/accept', { body: { token: outsiderInvite } });
  assert(anonymous.status === 401 && anonymous.data.code === 'SIGN_IN_TO_ACCEPT', 'They must sign in to accept');
  const wrongUser = await api('POST', '/api/invitations/accept', { token: newcomerToken, body: { token: outsiderInvite } });
  assert(wrongUser.status === 401, 'Someone signed in as another account can’t accept it');
  const outsiderJoins = await api('POST', '/api/invitations/accept', { token: outsider.token, body: { token: outsiderInvite } });
  assert(outsiderJoins.status === 200 && (await roleOf(org.id, outsider.user.id)) === 'COORDINATOR', 'Signed in as the invited account, they join');

  // ------------------------------------------------------------------
  section('Cancelling and expiry');
  const cancelEmail = email('cancelled');
  const toCancel = await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: cancelEmail } });
  const cancelToken = inviteTokenFor(cancelEmail);
  assert((await api('DELETE', `/api/organizations/${org.id}/invitations/${toCancel.data.data.invitation.id}`, { token: newcomerToken })).status === 403, 'Coordinators can’t cancel invitations');
  assert((await api('DELETE', `/api/organizations/${org.id}/invitations/${toCancel.data.data.invitation.id}`, { token: owner.token })).status === 200, 'The NGO admin cancels it');
  assert((await api('POST', '/api/invitations/preview', { body: { token: cancelToken } })).status === 400, 'A cancelled link stops working');
  assert((await api('DELETE', `/api/organizations/${org.id}/invitations/${toCancel.data.data.invitation.id}`, { token: owner.token })).status === 404, 'Cancelling twice returns 404');

  const expireEmail = email('expired');
  const toExpire = await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: expireEmail } });
  await pool.query("UPDATE organization_invitations SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [toExpire.data.data.invitation.id]);
  const expired = await api('POST', '/api/invitations/preview', { body: { token: inviteTokenFor(expireEmail) } });
  assert(expired.status === 400 && expired.data.code === 'INVITATION_INVALID', 'An expired link stops working');

  // ------------------------------------------------------------------
  section('Coordinators: what they can and can’t do');
  const coordTeam = await api('GET', `/api/organizations/${org.id}/team`, { token: newcomerToken });
  assert(coordTeam.status === 200 && coordTeam.data.data.invitations.length === 0 && coordTeam.data.data.members.length === 3, 'Coordinators see the members but not the invitations');
  const coordInvite = await api('POST', `/api/organizations/${org.id}/invitations`, { token: newcomerToken, body: { email: email('y') } });
  assert(coordInvite.status === 403 && coordInvite.data.code === 'NOT_NGO_ADMIN', 'Coordinators can’t invite');
  assert((await api('DELETE', `/api/organizations/${org.id}/members/${outsider.user.id}`, { token: newcomerToken })).status === 403, 'Coordinators can’t remove others');

  // ------------------------------------------------------------------
  section('Removing, leaving and handing over');
  const removed = await api('DELETE', `/api/organizations/${org.id}/members/${outsider.user.id}`, { token: owner.token });
  assert(removed.status === 200 && (await roleOf(org.id, outsider.user.id)) === null, 'The NGO admin removes a coordinator');
  const removedNote = await pool.query("SELECT 1 FROM notifications WHERE user_id = $1 AND title = 'Removed from an NGO'", [outsider.user.id]);
  assert(removedNote.rows.length === 1, 'The removed coordinator is told');
  assert((await api('DELETE', `/api/organizations/${org.id}/members/${owner.user.id}`, { token: owner.token })).data.code === 'OWNER_CANNOT_LEAVE', 'The NGO admin can’t leave without handing over');

  // A coordinator who already runs another NGO can't become NGO admin here.
  const otherOwner = await account('otherowner', 'COORDINATOR');
  await api('POST', '/api/organizations', { token: otherOwner.token, body: { name: `Other NGO ${stamp}`, registration_type: 'SOCIETY', city: 'Delhi' } });
  await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: otherOwner.email } });
  await api('POST', '/api/invitations/accept', { token: otherOwner.token, body: { token: inviteTokenFor(otherOwner.email) } });
  const blockedTransfer = await api('POST', `/api/organizations/${org.id}/transfer-ownership`, { token: owner.token, body: { user_id: otherOwner.user.id } });
  assert(blockedTransfer.status === 409 && blockedTransfer.data.code === 'ALREADY_OWNS_ORGANIZATION', 'Can’t hand over to someone who already runs an NGO');
  assert((await api('POST', `/api/organizations/${org.id}/transfer-ownership`, { token: owner.token, body: { user_id: volunteer.user.id } })).status === 404, 'Can’t hand over to a non-member');

  const handover = await api('POST', `/api/organizations/${org.id}/transfer-ownership`, { token: owner.token, body: { user_id: newcomer.id } });
  assert(handover.status === 200, 'The NGO admin hands over to a coordinator');
  assert((await roleOf(org.id, newcomer.id)) === 'OWNER' && (await roleOf(org.id, owner.user.id)) === 'COORDINATOR', 'Roles are swapped');
  assert((await api('POST', `/api/organizations/${org.id}/invitations`, { token: owner.token, body: { email: email('z') } })).status === 403, 'The former NGO admin can no longer invite');
  const edit = await api('PATCH', `/api/organizations/${org.id}`, { token: newcomerToken, body: { description: 'Edited by the new NGO admin' } });
  assert(edit.status === 200, 'The new NGO admin can edit the NGO profile');

  const leave = await api('DELETE', `/api/organizations/${org.id}/members/${owner.user.id}`, { token: owner.token });
  assert(leave.status === 200 && (await roleOf(org.id, owner.user.id)) === null, 'A coordinator can leave the NGO');
};

const cleanup = async () => {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = ANY($1)', [emails]);
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await pool.query(
        `DELETE FROM organizations WHERE id IN (SELECT organization_id FROM organization_members WHERE user_id = ANY($1))`,
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
    console.log(`\n${c.bold}NGO TEAM: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
