const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate opportunityId parameter for signup endpoint
 * Strips any user-provided volunteer_id in req.body to prevent privilege escalation / spoofing.
 */
const validateSignupOpportunityId = (req, res, next) => {
  const { opportunityId } = req.params;

  if (!opportunityId || !UUID_REGEX.test(opportunityId.trim())) {
    return next(
      new AppError('Invalid opportunity ID format. Expected a valid UUID', 400)
    );
  }

  // Prevent client from attempting to spoof volunteer_id via request body
  if (req.body && req.body.volunteer_id !== undefined) {
    delete req.body.volunteer_id;
  }

  next();
};

/**
 * Middleware to validate signup UUID parameter in URL
 */
const validateSignupId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !UUID_REGEX.test(id.trim())) {
    return next(
      new AppError('Invalid signup ID format. Expected a valid UUID', 400)
    );
  }

  next();
};

module.exports = {
  validateSignupOpportunityId,
  validateSignupId,
};
