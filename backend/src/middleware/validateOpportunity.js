const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

/**
 * Validate request body for creating an opportunity
 */
const validateCreateOpportunity = (req, res, next) => {
  const { organization_id, title, event_date, start_time, end_time, location, capacity } = req.body;

  if (!organization_id || !UUID_REGEX.test(organization_id)) {
    return next(new AppError('A valid organization_id UUID is required', 400));
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return next(new AppError('Opportunity title is required', 400));
  }
  if (title.trim().length > 255) {
    return next(new AppError('Title must be 255 characters or fewer', 400));
  }
  if (!event_date || !DATE_REGEX.test(event_date)) {
    return next(new AppError('event_date is required and must be in YYYY-MM-DD format', 400));
  }
  if (!start_time || !TIME_REGEX.test(start_time)) {
    return next(new AppError('start_time is required and must be in HH:MM format', 400));
  }
  if (!end_time || !TIME_REGEX.test(end_time)) {
    return next(new AppError('end_time is required and must be in HH:MM format', 400));
  }
  if (start_time >= end_time) {
    return next(new AppError('end_time must be after start_time', 400));
  }
  if (!location || typeof location !== 'string' || !location.trim()) {
    return next(new AppError('Location is required', 400));
  }
  const capacityNum = Number(capacity);
  if (!capacity || isNaN(capacityNum) || capacityNum < 1 || !Number.isInteger(capacityNum)) {
    return next(new AppError('Capacity must be a positive integer', 400));
  }

  // Sanitize
  req.body.title = title.trim();
  req.body.location = location.trim();
  req.body.capacity = capacityNum;

  next();
};

/**
 * Validate opportunity UUID in URL params
 */
const validateOpportunityId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    return next(new AppError('Invalid opportunity ID. Expected a valid UUID', 400));
  }
  next();
};

module.exports = {
  validateCreateOpportunity,
  validateOpportunityId,
};
