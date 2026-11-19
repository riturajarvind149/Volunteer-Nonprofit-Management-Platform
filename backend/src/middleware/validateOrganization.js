const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const { isSafeHttpUrl, EMAIL_REGEX } = require('../utils/validators');

const TEXT_LIMITS = { name: [2, 255], description: [0, 2000], phone: [0, 30], address: [0, 500] };
const SOCIAL_KEYS = ['facebook', 'twitter', 'x', 'instagram', 'linkedin', 'youtube', 'website'];

/**
 * Validate & sanitise PATCH /api/organizations/:id
 * Blocks unsafe URLs (javascript:, data:) that would otherwise be rendered as links.
 */
const validateUpdateOrganization = (req, res, next) => {
  const body = req.body || {};
  const clean = {};

  for (const [field, [min, max]] of Object.entries(TEXT_LIMITS)) {
    if (body[field] === undefined) continue;
    if (body[field] === null && field !== 'name') {
      clean[field] = null;
      continue;
    }
    if (typeof body[field] !== 'string') {
      return next(new AppError(`${field} must be a text string`, 400));
    }
    const value = body[field].trim();
    if (value.length < min || value.length > max) {
      return next(new AppError(`${field} must be between ${min} and ${max} characters`, 400));
    }
    clean[field] = value || null;
  }

  if (body.email !== undefined) {
    if (body.email === null || body.email === '') {
      clean.email = null;
    } else if (typeof body.email !== 'string' || !EMAIL_REGEX.test(body.email.trim())) {
      return next(new AppError('Organization email must be a valid email address', 400));
    } else {
      clean.email = body.email.trim().toLowerCase();
    }
  }

  for (const field of ['website', 'logo_url']) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === '') {
      clean[field] = null;
    } else if (!isSafeHttpUrl(body[field])) {
      return next(new AppError(`${field} must be a valid http(s) URL`, 400));
    } else {
      clean[field] = body[field].trim();
    }
  }

  if (body.social_links !== undefined) {
    if (body.social_links === null) {
      clean.social_links = null;
    } else if (typeof body.social_links !== 'object' || Array.isArray(body.social_links)) {
      return next(new AppError('social_links must be an object', 400));
    } else {
      const links = {};
      for (const [key, value] of Object.entries(body.social_links)) {
        if (!SOCIAL_KEYS.includes(key)) continue;
        if (value === '' || value === null) continue;
        const isHandle = typeof value === 'string' && /^@?[A-Za-z0-9_.-]{1,100}$/.test(value.trim());
        if (!isHandle && !isSafeHttpUrl(value)) {
          return next(new AppError(`social_links.${key} must be a handle (e.g. @name) or an http(s) URL`, 400));
        }
        links[key] = value.trim();
      }
      clean.social_links = links;
    }
  }

  req.body = clean;
  next();
};

module.exports = {
  validateUpdateOrganization,
  validateOrganizationId,
};
