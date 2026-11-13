const express = require('express');
const signupController = require('../controllers/signupController');
const volunteerHoursController = require('../controllers/volunteerHoursController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { validateSignupId, validateUpdateSignupStatus } = require('../middleware/validateSignup');
const { validateRecordHours } = require('../middleware/validateVolunteerHours');

const router = express.Router();

/** GET /api/signups/my — volunteer's signups */
router.get('/my', authenticate, authorizeRoles('VOLUNTEER'), signupController.getMySignups);

/** GET /api/signups/my/waitlist — volunteer's waitlist positions */
router.get('/my/waitlist', authenticate, authorizeRoles('VOLUNTEER'), signupController.getMyWaitlist);

/** GET /api/signups/:id */
router.get('/:id', authenticate, validateSignupId, signupController.getSignupById);

/** PATCH /api/signups/:id/cancel — volunteer cancels own signup */
router.patch('/:id/cancel', authenticate, authorizeRoles('VOLUNTEER'), validateSignupId, signupController.cancelSignup);

/** PATCH /api/signups/:id/status — coordinator changes status */
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateUpdateSignupStatus,
  signupController.updateSignupStatus
);

/** PATCH /api/signups/:id/attendance — coordinator marks PRESENT / ABSENT */
router.patch(
  '/:id/attendance',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateSignupId,
  signupController.setAttendance
);

/** POST /api/signups/:signupId/hours — coordinator records hours */
router.post(
  '/:signupId/hours',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateRecordHours,
  volunteerHoursController.recordHours
);

/** POST /api/signups/:signupId/hours/self — volunteer logs own hours for review */
router.post(
  '/:signupId/hours/self',
  authenticate,
  authorizeRoles('VOLUNTEER'),
  volunteerHoursController.logOwnHours
);

module.exports = router;
