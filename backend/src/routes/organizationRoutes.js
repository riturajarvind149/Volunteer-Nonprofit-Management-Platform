const express = require('express');
const { validateNgoDetails } = require('../middleware/validateNgoRegistration');
const organizationController = require('../controllers/organizationController');
const teamController = require('../controllers/teamController');
const { sensitiveLimiter } = require('../middleware/rateLimiters');
const { authenticate, optionalAuthenticate } = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const {
  validateUpdateOrganization,
  validateOrganizationId,
} = require('../middleware/validateOrganization');

const router = express.Router();

/** POST /api/organizations — a coordinator without an NGO registers one (pending verification) */
router.post('/', authenticate, authorizeRoles('COORDINATOR'), validateNgoDetails, organizationController.create);

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

// ---- Team: members, invitations, handing over the NGO admin role ----
const member = [authenticate, authorizeRoles('COORDINATOR'), validateOrganizationId];

/** GET /api/organizations/:id/team — members (and, for the NGO admin, open invitations) */
router.get('/:id/team', ...member, teamController.getTeam);

/** POST /api/organizations/:id/invitations — NGO admin invites a coordinator by email */
router.post('/:id/invitations', ...member, sensitiveLimiter, teamController.invite);

/** DELETE /api/organizations/:id/invitations/:invitationId — NGO admin cancels an invitation */
router.delete('/:id/invitations/:invitationId', ...member, teamController.revokeInvitation);

/** DELETE /api/organizations/:id/members/:userId — NGO admin removes a coordinator, or a coordinator leaves */
router.delete('/:id/members/:userId', ...member, teamController.removeMember);

/** POST /api/organizations/:id/transfer-ownership — NGO admin hands the role to a coordinator */
router.post('/:id/transfer-ownership', ...member, teamController.transferOwnership);

module.exports = router;
