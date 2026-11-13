const express = require('express');
const opportunityController = require('../controllers/opportunityController');
const signupController = require('../controllers/signupController');
const { authenticate, optionalAuthenticate } = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const {
  validateCreateOpportunity,
  validateUpdateOpportunity,
  validateOpportunityId,
} = require('../middleware/validateOpportunity');
const { validateSignupOpportunityId } = require('../middleware/validateSignup');

const router = express.Router();

/** POST /api/opportunities — coordinator creates an opportunity */
router.post('/', authenticate, authorizeRoles('COORDINATOR'), validateCreateOpportunity, opportunityController.create);

/** GET /api/opportunities — public search (filters + pagination); ?managed=true for coordinators */
router.get('/', optionalAuthenticate, opportunityController.getAll);

/** GET /api/opportunities/dashboard-stats */
router.get(
  '/dashboard-stats',
  authenticate,
  authorizeRoles('VOLUNTEER', 'COORDINATOR'),
  opportunityController.getDashboardStats
);

/** POST /api/opportunities/process-completions — manual trigger of the completion job */
router.post(
  '/process-completions',
  authenticate,
  authorizeRoles('COORDINATOR', 'ADMIN'),
  opportunityController.processCompletions
);

/** GET /api/opportunities/my-signups */
router.get('/my-signups', authenticate, authorizeRoles('VOLUNTEER'), signupController.getMySignups);

/** GET /api/opportunities/:id — public for published opportunities of verified orgs */
router.get('/:id', optionalAuthenticate, validateOpportunityId, opportunityController.getById);

/** GET /api/opportunities/:id/calendar.ics — add to calendar */
router.get('/:id/calendar.ics', optionalAuthenticate, validateOpportunityId, opportunityController.getCalendar);

/** PATCH /api/opportunities/:id — owner coordinator only */
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateOpportunityId,
  validateUpdateOpportunity,
  opportunityController.update
);

/** GET /api/opportunities/:id/signups — attendees + waitlist (owner coordinator) */
router.get(
  '/:id/signups',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateOpportunityId,
  signupController.getOpportunityAttendees
);

/** POST /api/opportunities/:id/check-in — volunteer self check-in with event code */
router.post('/:id/check-in', authenticate, authorizeRoles('VOLUNTEER'), validateOpportunityId, signupController.checkIn);

/** POST / DELETE /api/opportunities/:id/waitlist */
router.post('/:id/waitlist', authenticate, authorizeRoles('VOLUNTEER'), validateOpportunityId, signupController.joinWaitlist);
router.delete('/:id/waitlist', authenticate, authorizeRoles('VOLUNTEER'), validateOpportunityId, signupController.leaveWaitlist);

/** POST /api/opportunities/:opportunityId/signup */
router.post(
  '/:opportunityId/signup',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  validateSignupOpportunityId,
  signupController.createSignup
);

/** DELETE /api/opportunities/:opportunityId/signup */
router.delete(
  '/:opportunityId/signup',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  validateSignupOpportunityId,
  signupController.cancelSignupByOpportunity
);

module.exports = router;
