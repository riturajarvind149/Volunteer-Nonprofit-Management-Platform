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

  // Prevent client from attempting to spoof volunteer_id via request body
  if (req.body && req.body.volunteer_id !== undefined) {
    delete req.body.volunteer_id;
  }

  next();
};

const ALLOWED_SIGNUP_STATUSES = ['REGISTERED', 'CANCELLED'];

/**
 * Middleware to validate updating signup status by coordinator
 */
const validateUpdateSignupStatus = (req, res, next) => {
  const { id } = req.params;

  // 1. Validate signup ID format (UUID)
  if (!id || !UUID_REGEX.test(id.trim())) {
    return next(
      new AppError('Invalid signup ID format. Expected a valid UUID', 400)
    );
  }

  const { status } = req.body || {};

  // 2. Require status in request body
  if (status === undefined || status === null) {
    return next(new AppError('Status is required', 400));
  }

  if (typeof status !== 'string' || status.trim() === '') {
    return next(new AppError('Status must be a valid non-empty string', 400));
  }

  // 3. Normalize status to uppercase
  const normalizedStatus = status.trim().toUpperCase();

  // 4. Reject unsupported statuses with HTTP 400
  if (!ALLOWED_SIGNUP_STATUSES.includes(normalizedStatus)) {
    return next(
      new AppError(
        'Invalid status. Status must be one of: REGISTERED, CANCELLED',
        400
      )
    );
  }

  // 5. Ignore/strip attempts to modify ownership or immutable fields
  if (req.body.volunteer_id !== undefined) delete req.body.volunteer_id;
  if (req.body.opportunity_id !== undefined) delete req.body.opportunity_id;
  if (req.body.coordinator_id !== undefined) delete req.body.coordinator_id;
  if (req.body.organization_id !== undefined) delete req.body.organization_id;
  if (req.body.hours !== undefined) delete req.body.hours;
  if (req.body.created_at !== undefined) delete req.body.created_at;
  if (req.body.updated_at !== undefined) delete req.body.updated_at;
  if (req.body.id !== undefined) delete req.body.id;

  req.body.status = normalizedStatus;

  next();
};

module.exports = {
  validateSignupOpportunityId,
  validateSignupId,
  validateUpdateSignupStatus,
};
