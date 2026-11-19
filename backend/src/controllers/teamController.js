const teamService = require('../services/teamService');
const { isUuid } = require('../utils/validators');
const AppError = require('../utils/AppError');

const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

const uuidParam = (req, name) => {
  const value = req.params[name];
  if (!isUuid(value)) throw new AppError(`Invalid ${name} format. Expected a valid UUID`, 400);
  return value;
};

/** GET /api/organizations/:id/team */
const getTeam = handle(async (req, res) => {
  const team = await teamService.getTeam(req.params.id, req.user);
  res.status(200).json({ status: 'success', data: team });
});

/** POST /api/organizations/:id/invitations  { email } */
const invite = handle(async (req, res) => {
  const result = await teamService.inviteCoordinator(req.params.id, req.user, req.body?.email);
  res.status(201).json({
    status: 'success',
    message: result.email_sent
      ? `Invitation sent to ${result.invitation.email}`
      : `Invitation created, but the email could not be sent. Try resending it in a few minutes.`,
    data: result,
  });
});

/** DELETE /api/organizations/:id/invitations/:invitationId */
const revokeInvitation = handle(async (req, res) => {
  await teamService.revokeInvitation(req.params.id, req.user, uuidParam(req, 'invitationId'));
  res.status(200).json({ status: 'success', message: 'Invitation cancelled' });
});

/** DELETE /api/organizations/:id/members/:userId — remove a coordinator, or leave (own id) */
const removeMember = handle(async (req, res) => {
  const userId = uuidParam(req, 'userId');
  await teamService.removeMember(req.params.id, req.user, userId);
  res.status(200).json({ status: 'success', message: userId === req.user.id ? 'You left the NGO' : 'Coordinator removed' });
});

/** POST /api/organizations/:id/transfer-ownership  { user_id } */
const transferOwnership = handle(async (req, res) => {
  const newOwnerId = req.body?.user_id;
  if (!isUuid(newOwnerId)) throw new AppError('Choose a coordinator to hand over to', 400);
  await teamService.transferOwnership(req.params.id, req.user, newOwnerId);
  res.status(200).json({ status: 'success', message: 'The NGO admin role was handed over' });
});

/** POST /api/invitations/preview  { token } — public */
const previewInvitation = handle(async (req, res) => {
  const invitation = await teamService.previewInvitation(req.body?.token);
  res.status(200).json({ status: 'success', data: { invitation } });
});

/** POST /api/invitations/accept  { token, full_name?, password? } — public, or signed in as the invited account */
const acceptInvitation = handle(async (req, res) => {
  const { token, full_name, password } = req.body || {};
  const result = await teamService.acceptInvitation(token, { full_name, password }, req.user || null);
  res.status(200).json({ status: 'success', message: `You joined ${result.organization_name}`, data: result });
});

module.exports = { getTeam, invite, revokeInvitation, removeMember, transferOwnership, previewInvitation, acceptInvitation };
