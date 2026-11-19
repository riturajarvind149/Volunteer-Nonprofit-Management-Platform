const organizationRepository = require('../repositories/organizationRepository');
const organizationMemberRepository = require('../repositories/organizationMemberRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');
const { paginationMeta } = require('../utils/validators');

/**
 * Whether a user may see an organization regardless of its verification status:
 * platform admins and the organization's own members.
 * Expects `organization.my_role` (loaded for this user).
 */
const canManage = (organization, user) => Boolean(user && (user.role === 'ADMIN' || organization.my_role));

/** The rules every NGO registration follows, checked before anything is saved. */
const assertCanRegisterNgo = async (ownerId, details) => {
  if (ownerId && (await organizationMemberRepository.ownsAnOrganization(ownerId))) {
    throw new AppError('You already run an NGO on ServeHub. Each account can register one NGO.', 409, 'ALREADY_OWNS_ORGANIZATION');
  }
  if (await organizationRepository.findActiveByName(details.name)) {
    throw new AppError(
      'An NGO with this name is already registered. If it is yours, ask its NGO admin to invite you.',
      409,
      'ORG_NAME_TAKEN'
    );
  }
};

/**
 * Save a newly registered NGO with `ownerId` as its NGO admin.
 * New NGOs wait for admin approval when REQUIRE_ORG_APPROVAL is enabled.
 * @param {Object} [client] - join the caller's transaction
 */
const createNgo = (ownerId, details, client = null) =>
  organizationRepository.create(
    { ...details, ownerId, verification_status: config.requireOrgApproval ? 'PENDING' : 'APPROVED' },
    client
  );

/** Tell platform admins a new NGO is waiting for verification. Never throws. */
const notifyAdminsOfNewNgo = async (organization, ownerName) => {
  if (organization.verification_status !== 'PENDING') return;
  try {
    const admins = await userRepository.findAdmins();
    await Promise.all(
      admins.map((admin) =>
        notificationService.notify({
          user: admin,
          title: 'Organization awaiting review',
          message: `${organization.name} was registered and needs verification.`,
          type: 'ORG_REVIEW',
          reference_id: organization.id,
          email: templates.orgSubmitted({ orgName: organization.name, ownerName: ownerName || 'An NGO admin' }),
        })
      )
    );
  } catch {
    // non-blocking
  }
};

/**
 * A signed-in coordinator who doesn't run an NGO yet registers one and becomes its NGO admin.
 */
const registerNgoForUser = async (user, details) => {
  await assertCanRegisterNgo(user.id, details);
  const organization = await createNgo(user.id, details);
  const owner = await userRepository.findById(user.id);
  await notifyAdminsOfNewNgo(organization, owner?.full_name);
  return organization;
};

/**
 * List organizations visible to the caller.
 * Public / volunteers: APPROVED only. Coordinators: APPROVED + the ones they belong to. Admins: all (optionally filtered).
 */
const listOrganizations = async (user, { q, status, page, limit, offset }) => {
  let statuses = ['APPROVED'];
  let includeMemberId;

  if (user?.role === 'ADMIN') {
    statuses = status ? [status] : undefined;
  } else if (user?.role === 'COORDINATOR') {
    includeMemberId = user.id;
  }

  const { organizations, total } = await organizationRepository.search({
    q,
    statuses,
    includeMemberId,
    viewerId: user?.id,
    limit,
    offset,
  });

  return { organizations, pagination: paginationMeta({ page, limit }, total) };
};

const getOrganizationById = async (id, user) => {
  const organization = await organizationRepository.findById(id, user?.id);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }
  if (organization.verification_status !== 'APPROVED' && !canManage(organization, user)) {
    throw new AppError('Organization not found', 404);
  }
  return organization;
};

/** Organizations the user belongs to (owner or coordinator), each with `my_role`. */
const getMyOrganizations = async (userId) => organizationRepository.findByMember(userId);

/** Only the organization's owner (the NGO admin) may edit its profile. */
const updateOrganization = async (id, userId, updateFields) => {
  const organization = await organizationRepository.findById(id, userId);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  if (organization.my_role !== 'OWNER') {
    throw new AppError('Only the organization’s owner can update its profile', 403);
  }

  const updated = await organizationRepository.update(id, updateFields);
  return { ...updated, my_role: organization.my_role };
};

const getOrganizationImpact = async (id, user) => {
  const organization = await getOrganizationById(id, user);
  const impact = await organizationRepository.getOrganizationImpactStats(id);
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      description: organization.description,
      logo_url: organization.logo_url,
      verification_status: organization.verification_status,
    },
    impact,
  };
};

module.exports = {
  assertCanRegisterNgo,
  createNgo,
  notifyAdminsOfNewNgo,
  registerNgoForUser,
  listOrganizations,
  getMyOrganizations,
  getOrganizationById,
  updateOrganization,
  getOrganizationImpact,
};
