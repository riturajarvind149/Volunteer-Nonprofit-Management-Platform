const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Server-side validation middleware for creating an organization.
 * Validates name and optional description.
 */
const validateCreateOrganization = (req, res, next) => {
  const { name, description } = req.body;

  // 1. Validate name presence and type
  if (!name || typeof name !== 'string' || !name.trim()) {
    return next(new AppError('Organization name is required', 400));
  }

  // 2. Validate name length
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 255) {
    return next(new AppError('Organization name must be between 2 and 255 characters', 400));
  }

  // 3. Validate description if provided
  let trimmedDescription = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return next(new AppError('Description must be a valid text string', 400));
    }
    trimmedDescription = description.trim();
    if (trimmedDescription.length > 2000) {
      return next(new AppError('Description must not exceed 2000 characters', 400));
    }
  }

  // Sanitize req.body and prevent client-supplied coordinator_id override
  req.body.name = trimmedName;
  req.body.description = trimmedDescription;
  delete req.body.coordinator_id;

  next();
};

/**
 * Middleware to validate organization UUID parameter in URL
 */
const validateOrganizationId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !UUID_REGEX.test(id)) {
    return next(new AppError('Invalid organization ID format. Expected a valid UUID', 400));
  }

  next();
};

module.exports = {
  validateCreateOrganization,
  validateOrganizationId,
};
