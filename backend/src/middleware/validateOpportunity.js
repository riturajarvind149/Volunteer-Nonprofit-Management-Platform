const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_STATUSES = ['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'];

/**
 * Normalizes time string to HH:MM:SS for accurate string comparison
 * @param {string} timeStr
 * @returns {string}
 */
const normalizeTime = (timeStr) => {
  return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
};

/**
 * Server-side validation middleware for creating an opportunity
 */
const validateCreateOpportunity = (req, res, next) => {
  const {
    organization_id,
    title,
    description,
    category,
    event_date,
    start_time,
    end_time,
    location,
    address,
    capacity,
    status,
  } = req.body;

  // 1. Validate organization_id
  if (!organization_id || typeof organization_id !== 'string') {
    return next(new AppError('Organization ID is required', 400));
  }
  if (!UUID_REGEX.test(organization_id.trim())) {
    return next(new AppError('Invalid organization ID format. Expected a valid UUID', 400));
  }

  // 2. Validate title
  if (!title || typeof title !== 'string' || !title.trim()) {
    return next(new AppError('Opportunity title is required', 400));
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 2 || trimmedTitle.length > 255) {
    return next(new AppError('Opportunity title must be between 2 and 255 characters', 400));
  }

  // 3. Validate description (optional)
  let trimmedDescription = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return next(new AppError('Description must be a valid text string', 400));
    }
    trimmedDescription = description.trim();
    if (trimmedDescription.length > 5000) {
      return next(new AppError('Description must not exceed 5000 characters', 400));
    }
  }

  // 4. Validate category (optional)
  let trimmedCategory = null;
  if (category !== undefined && category !== null) {
    if (typeof category !== 'string') {
      return next(new AppError('Category must be a valid text string', 400));
    }
    trimmedCategory = category.trim();
    if (trimmedCategory.length > 100) {
      return next(new AppError('Category must not exceed 100 characters', 400));
    }
  }

  // 5. Validate event_date
  if (!event_date || typeof event_date !== 'string' || !DATE_REGEX.test(event_date.trim())) {
    return next(new AppError('Event date is required and must be in YYYY-MM-DD format', 400));
  }
  const trimmedEventDate = event_date.trim();
  if (isNaN(Date.parse(trimmedEventDate))) {
    return next(new AppError('Event date must be a valid calendar date', 400));
  }

  // 6. Validate start_time
  if (!start_time || typeof start_time !== 'string' || !TIME_REGEX.test(start_time.trim())) {
    return next(new AppError('Start time is required and must be in HH:MM or HH:MM:SS format', 400));
  }
  const trimmedStartTime = start_time.trim();

  // 7. Validate end_time
  if (!end_time || typeof end_time !== 'string' || !TIME_REGEX.test(end_time.trim())) {
    return next(new AppError('End time is required and must be in HH:MM or HH:MM:SS format', 400));
  }
  const trimmedEndTime = end_time.trim();

  if (normalizeTime(trimmedEndTime) < normalizeTime(trimmedStartTime)) {
    return next(new AppError('End time must not be earlier than start time', 400));
  }

  // 8. Validate location (optional in body, defaults to 'Location TBD' for database NOT NULL column)
  let trimmedLocation = 'Location TBD';
  if (location !== undefined && location !== null) {
    if (typeof location !== 'string') {
      return next(new AppError('Location must be a valid text string', 400));
    }
    if (location.trim()) {
      trimmedLocation = location.trim();
    }
  }

  // 9. Validate address (optional)
  let trimmedAddress = null;
  if (address !== undefined && address !== null) {
    if (typeof address !== 'string') {
      return next(new AppError('Address must be a valid text string', 400));
    }
    trimmedAddress = address.trim();
  }

  // 10. Validate capacity
  if (
    capacity === undefined ||
    capacity === null ||
    typeof capacity !== 'number' ||
    !Number.isInteger(capacity) ||
    capacity <= 0
  ) {
    return next(new AppError('Capacity is required and must be a positive integer greater than 0', 400));
  }

  // 11. Validate status (optional, defaults to 'DRAFT')
  let normalizedStatus = 'DRAFT';
  if (status !== undefined && status !== null) {
    if (typeof status !== 'string') {
      return next(new AppError('Status must be a valid string', 400));
    }
    normalizedStatus = status.trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return next(
        new AppError('Invalid status. Status must be one of: DRAFT, PUBLISHED, COMPLETED, CANCELLED', 400)
      );
    }
  }

  // Assign sanitized values back to req.body
  req.body = {
    organization_id: organization_id.trim(),
    title: trimmedTitle,
    description: trimmedDescription,
    category: trimmedCategory,
    event_date: trimmedEventDate,
    start_time: trimmedStartTime,
    end_time: trimmedEndTime,
    location: trimmedLocation,
    address: trimmedAddress,
    capacity,
    status: normalizedStatus,
  };

  next();
};

/**
 * Middleware to validate opportunity UUID parameter in URL
 */
const validateOpportunityId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !UUID_REGEX.test(id)) {
    return next(new AppError('Invalid opportunity ID format. Expected a valid UUID', 400));
  }

  next();
};

module.exports = {
  validateCreateOpportunity,
  validateOpportunityId,
};
