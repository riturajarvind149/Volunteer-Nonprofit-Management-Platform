const organizationRepository = require('../repositories/organizationRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const templates = require('./emailTemplates');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');
const { paginationMeta } = require('../utils/validators');

/**
 * Whether a user may see an organization regardless of its verification status.
 */
const canManage = (organization, user) =>
  Boolean(user && (user.role === 'ADMIN' || organization.coordinator_id === user.id));

/**
 * Create an organization. New organizations wait for admin approval when
 * REQUIRE_ORG_APPROVAL is enabled; admins are notified.
 */
const createOrganization = async ({ name, description, coordinator_id }) => {
  const organization = await organizationRepository.create({
    name,
    description,
    coordinator_id,
    verification_status: config.requireOrgApproval ? 'PENDING' : 'APPROVED',
  });

  if (organization.verification_status === 'PENDING') {
    try {
      const [admins, coordinator] = await Promise.all([
        userRepository.findAdmins(),
        userRepository.findById(coordinator_id),
      ]);
      await Promise.all(
        admins.map((admin) =>
          notificationService.notify({
            user: admin,
            title: 'Organization awaiting review',
            message: `${organization.name} was registered and needs verification.`,
            type: 'ORG_REVIEW',
            reference_id: organization.id,
            email: templates.orgSubmitted({ orgName: organization.name, coordinatorName: coordinator?.full_name || 'A coordinator' }),
          })
        )
      );
    } catch {
      // non-blocking
    }
  }

  return organization;
};

/**
 * List organizations visible to the caller.
 * Public / volunteers: APPROVED only. Coordinators: APPROVED + their own. Admins: all (optionally filtered).
 */
const listOrganizations = async (user, { q, status, page, limit, offset }) => {
  let statuses = ['APPROVED'];
  let includeCoordinatorId;

  if (user?.role === 'ADMIN') {
    statuses = status ? [status] : undefined;
  } else if (user?.role === 'COORDINATOR') {
    includeCoordinatorId = user.id;
  }

  const { organizations, total } = await organizationRepository.search({
    q,
    statuses,
    includeCoordinatorId,
    limit,
    offset,
  });

  return { organizations, pagination: paginationMeta({ page, limit }, total) };
};

/** @deprecated kept for internal callers */
const getAllOrganizations = async () => organizationRepository.findAll();

const getOrganizationById = async (id, user) => {
  const organization = await organizationRepository.findById(id);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }
  if (organization.verification_status !== 'APPROVED' && !canManage(organization, user)) {
    throw new AppError('Organization not found', 404);
  }
  return organization;
};

const updateOrganization = async (id, coordinatorId, updateFields) => {
  const organization = await organizationRepository.findById(id);
  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  if (organization.coordinator_id !== coordinatorId) {
    throw new AppError('You do not have permission to update this organization', 403);
  }

  return await organizationRepository.update(id, updateFields);
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
  createOrganization,
  listOrganizations,
  getAllOrganizations,
  getOrganizationById,
  updateOrganization,
  getOrganizationImpact,
  canManage,
};
