const express = require('express');
const organizationController = require('../controllers/organizationController');
const { authenticate, optionalAuthenticate } = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const {
  validateCreateOrganization,
  validateUpdateOrganization,
  validateOrganizationId,
} = require('../middleware/validateOrganization');

const router = express.Router();

/** POST /api/organizations — coordinator creates an organization (pending verification) */
router.post('/', authenticate, authorizeRoles('COORDINATOR'), validateCreateOrganization, organizationController.create);

/** GET /api/organizations — public directory (approved orgs; coordinators also see their own) */
router.get('/', optionalAuthenticate, organizationController.getAll);

/** GET /api/organizations/mine — coordinator's own organizations, any status */
router.get('/mine', authenticate, authorizeRoles('COORDINATOR'), organizationController.getMine);

/** GET /api/organizations/:id — public for approved orgs */
router.get('/:id', optionalAuthenticate, validateOrganizationId, organizationController.getById);

/** PATCH /api/organizations/:id — owner coordinator only */
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateOrganizationId,
  validateUpdateOrganization,
  organizationController.update
);

/** GET /api/organizations/:id/impact — public impact metrics */
router.get('/:id/impact', optionalAuthenticate, validateOrganizationId, organizationController.getImpact);

/** GET /api/organizations/:id/opportunities — public list of an org's opportunities */
router.get('/:id/opportunities', optionalAuthenticate, validateOrganizationId, organizationController.getOpportunities);

module.exports = router;
