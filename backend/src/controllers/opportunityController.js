const opportunityService = require('../services/opportunityService');
const opportunityCompletionService = require('../services/opportunityCompletionService');
const { buildEventIcs } = require('../utils/ical');
const { parsePagination, isUuid } = require('../utils/validators');
const { isValidDateString } = require('../middleware/validateOpportunity');
const AppError = require('../utils/AppError');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const str = (value, max = 100) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);

/**
 * POST /api/opportunities
 */
const create = handle(async (req, res) => {
  const opportunity = await opportunityService.createOpportunity(req.body, req.user.id);
  res.status(201).json({
    status: 'success',
    message: 'Opportunity created successfully',
    data: { opportunity },
  });
});

/**
 * GET /api/opportunities
 * Public search with filters & pagination:
 *   q, category, location, from_date, to_date, skills (comma list), available=true,
 *   upcoming=true|false, sort=date|newest|spots, organization_id, page, limit
 * ?managed=true returns all of the coordinator's own opportunities (any status).
 */
const getAll = handle(async (req, res) => {
  if (req.query.managed === 'true') {
    if (!req.user) {
      throw new AppError('Authorization header is required', 401);
    }
    if (req.user.role !== 'COORDINATOR') {
      throw new AppError('Only coordinators can access managed opportunities', 403);
    }
    const opportunities = await opportunityService.getManagedOpportunities(req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Opportunities retrieved successfully',
      data: { opportunities },
    });
  }

  const paging = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const from_date = str(req.query.from_date, 10);
  const to_date = str(req.query.to_date, 10);
  if ((from_date && !isValidDateString(from_date)) || (to_date && !isValidDateString(to_date))) {
    throw new AppError('Dates must use the YYYY-MM-DD format', 400);
  }
  const organization_id = str(req.query.organization_id, 36);
  if (organization_id && !isUuid(organization_id)) {
    throw new AppError('Invalid organization_id', 400);
  }

  const result = await opportunityService.searchOpportunities(req.user, {
    ...paging,
    q: str(req.query.q),
    category: str(req.query.category),
    location: str(req.query.location),
    from_date,
    to_date,
    organization_id,
    status: str(req.query.status, 20)?.toUpperCase(),
    upcoming: req.query.upcoming === 'true',
    available: req.query.available === 'true',
    skills: str(req.query.skills, 500)
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    sort: str(req.query.sort, 10),
  });

  res.status(200).json({
    status: 'success',
    message: 'Opportunities retrieved successfully',
    data: result,
  });
});

/**
 * GET /api/opportunities/:id
 */
const getById = handle(async (req, res) => {
  const opportunity = await opportunityService.getOpportunityById(req.params.id, req.user);
  res.status(200).json({
    status: 'success',
    message: 'Opportunity retrieved successfully',
    data: { opportunity },
  });
});

/**
 * GET /api/opportunities/:id/calendar.ics
 */
const getCalendar = handle(async (req, res) => {
  const opportunity = await opportunityService.getForCalendar(req.params.id, req.user);
  const safeName = opportunity.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60) || 'event';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.ics"`);
  res.status(200).send(buildEventIcs(opportunity));
});

/**
 * PATCH /api/opportunities/:id
 */
const update = handle(async (req, res) => {
  const opportunity = await opportunityService.updateOpportunity(req.params.id, req.body, req.user.id);
  res.status(200).json({
    status: 'success',
    message: 'Opportunity updated successfully',
    data: { opportunity },
  });
});

/**
 * GET /api/opportunities/dashboard-stats
 */
const getDashboardStats = handle(async (req, res) => {
  const stats = await opportunityService.getDashboardStats(req.user);
  res.status(200).json({
    status: 'success',
    message: 'Dashboard statistics retrieved successfully',
    data: { stats },
  });
});

/**
 * POST /api/opportunities/process-completions
 */
const processCompletions = handle(async (req, res) => {
  const summary = await opportunityCompletionService.processCompletedOpportunities();
  res.status(200).json({
    status: 'success',
    message: 'Opportunity completions processed successfully',
    data: summary,
  });
});

module.exports = {
  create,
  getAll,
  getById,
  getCalendar,
  update,
  getDashboardStats,
  processCompletions,
};
