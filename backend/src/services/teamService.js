const bcrypt = require('bcrypt');
const pool = require('../config/db');
const organizationRepository = require('../repositories/organizationRepository');
const organizationMemberRepository = require('../repositories/organizationMemberRepository');
const invitationRepository = require('../repositories/invitationRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const templates = require('./emailTemplates');
const { generateToken, validatePasswordStrength } = require('./authService');
const { EMAIL_REGEX } = require('../utils/validators');
const AppError = require('../utils/AppError');

/**
 * An NGO's team: the NGO admin (owner) invites coordinators by email, can cancel
 * invitations, remove coordinators and hand over the NGO admin role. Coordinators
 * can see the team and leave.
 */

const INVITATION_DAYS = 7;
const MAX_INVITATIONS_PER_DAY = 50;
const SALT_ROUNDS = 12;

/** The organization with the caller's role in it; 404 for non-members (no information leak). */
const loadMembership = async (organizationId, user) => {
  const organization = await organizationRepository.findById(organizationId, user.id);
  if (!organization || !organization.my_role) {
    throw new AppError('Organization not found', 404);
  }
  return organization;
};

const assertOwner = (organization) => {
  if (organization.my_role !== 'OWNER') {
    throw new AppError('Only the NGO admin can manage the team', 403, 'NOT_NGO_ADMIN');
  }
};

/** In-app team notice. TEAM notices link to the NGO's team page; INFO ones have no link. */
const notify = (userId, title, message, organizationId, type = 'TEAM') =>
  notificationService
    .createNotification({ user_id: userId, title, message, type, reference_id: type === 'TEAM' ? organizationId : null })
    .catch(() => {});

/** Members (owner first) and, for the owner, the open invitations. */
const getTeam = async (organizationId, user) => {
  const organization = await loadMembership(organizationId, user);
  const members = await organizationMemberRepository.findMembers(organizationId);
  const invitations = organization.my_role === 'OWNER' ? await invitationRepository.findOpenByOrganization(organizationId) : [];
  return {
    organization: { id: organization.id, name: organization.name, my_role: organization.my_role },
    members: members.map(({ email_notifications: _omit, ...m }) => m),
    invitations,
  };
};

/**
 * Invite someone to coordinate for the NGO. Re-inviting the same email replaces the
 * earlier link. Volunteer and admin accounts can't become coordinators.
 * @returns {Promise<{invitation: Object, email_sent: boolean}>}
 */
const inviteCoordinator = async (organizationId, user, rawEmail) => {
  const organization = await loadMembership(organizationId, user);
  assertOwner(organization);

  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!EMAIL_REGEX.test(email) || email.length > 255) {
    throw new AppError('Enter a valid email address', 400);
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    if (await organizationMemberRepository.findRole(organizationId, existing.id)) {
      throw new AppError('This person is already part of your NGO', 409, 'ALREADY_MEMBER');
    }
    if (existing.role !== 'COORDINATOR') {
      throw new AppError(
        existing.role === 'VOLUNTEER'
          ? 'This email belongs to a volunteer account. Coordinators need their own account — ask them for another email address.'
          : 'This email can’t be invited as a coordinator.',
        409,
        'EMAIL_NOT_INVITABLE'
      );
    }
    if (!existing.is_active) {
      throw new AppError('This account is suspended and can’t be invited', 409, 'EMAIL_NOT_INVITABLE');
    }
  }

  if ((await invitationRepository.countRecent(organizationId)) >= MAX_INVITATIONS_PER_DAY) {
    throw new AppError(`Your NGO can send up to ${MAX_INVITATIONS_PER_DAY} invitations a day. Try again tomorrow.`, 429, 'INVITATION_LIMIT');
  }

  const { invitation, token } = await invitationRepository.create({
    organizationId,
    email,
    invitedBy: user.id,
    ttlDays: INVITATION_DAYS,
  });
  const inviter = await userRepository.findById(user.id);
  const result = await emailService.sendEmail({
    to: email,
    ...templates.coordinatorInvitation({
      orgName: organization.name,
      inviterName: inviter?.full_name || 'Your NGO admin',
      token,
      days: INVITATION_DAYS,
    }),
  });
  // `logged` = email isn't configured (development): the link is in the server log instead.
  return { invitation, email_sent: Boolean(result?.delivered || result?.logged) };
};

const revokeInvitation = async (organizationId, user, invitationId) => {
  assertOwner(await loadMembership(organizationId, user));
  if (!(await invitationRepository.revoke(organizationId, invitationId))) {
    throw new AppError('Invitation not found or already used', 404);
  }
};

/**
 * Remove a coordinator (NGO admin), or leave the NGO (a coordinator removing themselves).
 * The NGO admin can't leave; they hand over the role first.
 */
const removeMember = async (organizationId, user, memberUserId) => {
  const organization = await loadMembership(organizationId, user);
  const leaving = memberUserId === user.id;
  if (leaving && organization.my_role === 'OWNER') {
    throw new AppError('Hand over the NGO admin role to a coordinator before leaving', 409, 'OWNER_CANNOT_LEAVE');
  }
  if (!leaving) assertOwner(organization);

  if (!(await organizationMemberRepository.removeCoordinator(organizationId, memberUserId))) {
    throw new AppError('Coordinator not found in this NGO', 404);
  }
  if (!leaving) {
    await notify(memberUserId, 'Removed from an NGO', `You are no longer a coordinator for ${organization.name}.`, organizationId, 'INFO');
  }
};

/** Hand over the NGO admin role to one of the NGO's coordinators. */
const transferOwnership = async (organizationId, user, newOwnerId) => {
  const organization = await loadMembership(organizationId, user);
  assertOwner(organization);
  if (newOwnerId === user.id) {
    throw new AppError('You are already the NGO admin', 400);
  }
  if ((await organizationMemberRepository.findRole(organizationId, newOwnerId)) !== 'COORDINATOR') {
    throw new AppError('Choose a coordinator of this NGO', 404);
  }
  if (await organizationMemberRepository.ownsAnOrganization(newOwnerId)) {
    throw new AppError('This coordinator already runs another NGO. Each account can be NGO admin of one NGO.', 409, 'ALREADY_OWNS_ORGANIZATION');
  }
  if (!(await organizationMemberRepository.transferOwnership(organizationId, user.id, newOwnerId))) {
    throw new AppError('The NGO admin role could not be handed over. Please try again.', 409);
  }
  await notify(newOwnerId, 'You are now the NGO admin', `You are now the NGO admin of ${organization.name}.`, organizationId);
};

const invalidInvitation = () =>
  new AppError('This invitation link is invalid, has expired or was already used. Ask your NGO admin for a new one.', 400, 'INVITATION_INVALID');

/** What the accept page needs to show. */
const previewInvitation = async (token) => {
  if (!token || typeof token !== 'string') throw invalidInvitation();
  const invitation = await invitationRepository.findOpenByToken(token);
  if (!invitation) throw invalidInvitation();
  const existing = await userRepository.findByEmail(invitation.email);
  return {
    organization_name: invitation.organization_name,
    invited_by_name: invitation.invited_by_name,
    email: invitation.email,
    expires_at: invitation.expires_at,
    account_exists: Boolean(existing),
    // Only the kind of account matters to the page; no other account details are shared.
    account_can_accept: !existing || (existing.role === 'COORDINATOR' && existing.is_active),
  };
};

/**
 * Accept an invitation.
 *  - No account for the invited email yet: create a verified coordinator account
 *    (opening the emailed link proves the address) and sign them in.
 *  - A coordinator account exists: the caller must be signed in as it.
 * @returns {Promise<{organization_id, organization_name, token?, user?}>}
 */
const acceptInvitation = async (token, { full_name, password } = {}, authUser = null) => {
  if (!token || typeof token !== 'string') throw invalidInvitation();
  const invitation = await invitationRepository.findOpenByToken(token);
  if (!invitation) throw invalidInvitation();

  const existing = await userRepository.findByEmail(invitation.email);
  if (existing) {
    if (existing.role !== 'COORDINATOR' || !existing.is_active) {
      throw new AppError(
        'This invitation is for an email that already has a non-coordinator account. Ask your NGO admin to invite a different email.',
        409,
        'EMAIL_NOT_INVITABLE'
      );
    }
    if (!authUser || authUser.id !== existing.id) {
      throw new AppError(`Sign in as ${invitation.email} to accept this invitation.`, 401, 'SIGN_IN_TO_ACCEPT');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!(await invitationRepository.markAccepted(invitation.id, existing.id, client))) throw invalidInvitation();
      await organizationMemberRepository.add(
        { organizationId: invitation.organization_id, userId: existing.id, role: 'COORDINATOR', addedBy: invitation.invited_by },
        client
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    await notifyInviter(invitation, existing.full_name);
    return { organization_id: invitation.organization_id, organization_name: invitation.organization_name };
  }

  // New account
  const name = typeof full_name === 'string' ? full_name.trim() : '';
  if (name.length < 2 || name.length > 255) {
    throw new AppError('Enter your full name (2 to 255 characters)', 400);
  }
  validatePasswordStrength(password);
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await userRepository.createUser({ full_name: name, email: invitation.email, password_hash, role: 'COORDINATOR' }, client);
    await client.query('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    if (!(await invitationRepository.markAccepted(invitation.id, user.id, client))) throw invalidInvitation();
    await organizationMemberRepository.add(
      { organizationId: invitation.organization_id, userId: user.id, role: 'COORDINATOR', addedBy: invitation.invited_by },
      client
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new AppError('Email is already registered', 409);
    throw err;
  } finally {
    client.release();
  }

  // Sign the new coordinator in, the same way a login does.
  const account = await userRepository.findByEmail(invitation.email);
  const sessionToken = generateToken(account);
  const { password_hash: _hash, token_version: _version, ...publicUser } = account;
  await notifyInviter(invitation, name);
  return {
    organization_id: invitation.organization_id,
    organization_name: invitation.organization_name,
    token: sessionToken,
    user: publicUser,
  };
};

const notifyInviter = async (invitation, joinedName) => {
  if (!invitation.invited_by) return;
  await notify(
    invitation.invited_by,
    'Coordinator joined',
    `${joinedName} accepted your invitation and joined ${invitation.organization_name} as a coordinator.`,
    invitation.organization_id
  );
};

module.exports = {
  getTeam,
  inviteCoordinator,
  revokeInvitation,
  removeMember,
  transferOwnership,
  previewInvitation,
  acceptInvitation,
};
