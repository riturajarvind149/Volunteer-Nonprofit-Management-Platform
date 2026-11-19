const express = require('express');
const teamController = require('../controllers/teamController');
const { optionalAuthenticate } = require('../middleware/authenticate');
const { loginLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

/** POST /api/invitations/preview — what an invitation link is for (public) */
router.post('/preview', loginLimiter, teamController.previewInvitation);

/** POST /api/invitations/accept — join the NGO (new account, or signed in as the invited account) */
router.post('/accept', loginLimiter, optionalAuthenticate, teamController.acceptInvitation);

module.exports = router;
