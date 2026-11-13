const express = require('express');
const adminService = require('../services/adminService');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { parsePagination, isUuid } = require('../utils/validators');
const AppError = require('../utils/AppError');

const router = express.Router();

router.use(authenticate, authorizeRoles('ADMIN'));

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const requireUuid = (req, res, next) =>
  isUuid(req.params.id) ? next() : next(new AppError('Invalid ID format. Expected a valid UUID', 400));

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : undefined);

/** GET /api/admin/stats */
router.get(
  '/stats',
  handle(async (req, res) => {
    res.json({ status: 'success', data: { stats: await adminService.getStats() } });
  })
);

/** GET /api/admin/organizations?status=PENDING&q=&page= */
router.get(
  '/organizations',
  handle(async (req, res) => {
    const paging = parsePagination(req.query);
    const data = await adminService.listOrganizations({
      ...paging,
      status: str(req.query.status)?.toUpperCase(),
      q: str(req.query.q),
    });
    res.json({ status: 'success', data });
  })
);

/** PATCH /api/admin/organizations/:id/verification { status, note } */
router.patch(
  '/organizations/:id/verification',
  requireUuid,
  handle(async (req, res) => {
    const organization = await adminService.reviewOrganization(
      req.params.id,
      { status: str(req.body.status)?.toUpperCase(), note: req.body.note },
      req.user.id
    );
    res.json({ status: 'success', message: 'Organization status updated', data: { organization } });
  })
);

/** GET /api/admin/users?q=&role=&page= */
router.get(
  '/users',
  handle(async (req, res) => {
    const paging = parsePagination(req.query);
    const data = await adminService.listUsers({ ...paging, q: str(req.query.q), role: str(req.query.role)?.toUpperCase() });
    res.json({ status: 'success', data });
  })
);

/** PATCH /api/admin/users/:id { is_active } */
router.patch(
  '/users/:id',
  requireUuid,
  handle(async (req, res) => {
    const user = await adminService.setUserActive(req.params.id, req.body.is_active, req.user.id);
    res.json({ status: 'success', message: user.is_active ? 'User reactivated' : 'User suspended', data: { user } });
  })
);

/** GET /api/admin/audit-logs */
router.get(
  '/audit-logs',
  handle(async (req, res) => {
    const data = await adminService.listAuditLogs(parsePagination(req.query));
    res.json({ status: 'success', data });
  })
);

module.exports = router;
