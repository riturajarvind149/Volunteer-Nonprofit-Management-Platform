const organizationService = require('../services/organizationService');
const opportunityService = require('../services/opportunityService');
const { parsePagination } = require('../utils/validators');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

/** POST /api/organizations */
const create = handle(async (req, res) => {
  const { name, description } = req.body;
  // Always use authenticated coordinator ID from req.user
  const organization = await organizationService.createOrganization({
    name,
    description,
    coordinator_id: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    message:
      organization.verification_status === 'PENDING'
        ? 'Organization created and submitted for verification'
        : 'Organization created successfully',
    data: { organization },
  });
});

/** GET /api/organizations?q=&status=&page=&limit= (public) */
const getAll = handle(async (req, res) => {
  const paging = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const result = await organizationService.listOrganizations(req.user, { q, status, ...paging });

  res.status(200).json({
    status: 'success',
    message: 'Organizations retrieved successfully',
    data: result,
  });
});

/** GET /api/organizations/mine (coordinator) */
const getMine = handle(async (req, res) => {
  const organizationRepository = require('../repositories/organizationRepository');
  const organizations = await organizationRepository.findByCoordinatorId(req.user.id);
  res.status(200).json({ status: 'success', data: { organizations } });
});

/** GET /api/organizations/:id (public for approved orgs) */
const getById = handle(async (req, res) => {
  const organization = await organizationService.getOrganizationById(req.params.id, req.user);
  res.status(200).json({
    status: 'success',
    message: 'Organization retrieved successfully',
    data: { organization },
  });
});

/** PATCH /api/organizations/:id */
const update = handle(async (req, res) => {
  const organization = await organizationService.updateOrganization(req.params.id, req.user.id, req.body);
  res.status(200).json({
    status: 'success',
    message: 'Organization updated successfully',
    data: { organization },
  });
});

/** GET /api/organizations/:id/impact (public for approved orgs) */
const getImpact = handle(async (req, res) => {
  const result = await organizationService.getOrganizationImpact(req.params.id, req.user);
  res.status(200).json({
    status: 'success',
    message: 'Organization impact retrieved successfully',
    data: result,
  });
});

/** GET /api/organizations/:id/opportunities (public) */
const getOpportunities = handle(async (req, res) => {
  await organizationService.getOrganizationById(req.params.id, req.user);
  const paging = parsePagination(req.query, { defaultLimit: 50 });
  const result = await opportunityService.searchOpportunities(req.user, {
    ...paging,
    organization_id: req.params.id,
    upcoming: req.query.upcoming !== 'false',
  });
  res.status(200).json({ status: 'success', data: result });
});

module.exports = {
  create,
  getAll,
  getMine,
  getById,
  update,
  getImpact,
  getOpportunities,
};
