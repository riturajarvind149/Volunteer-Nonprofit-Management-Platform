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
 * Validates real calendar date including leap years
 * @param {string} dateStr YYYY-MM-DD
 * @returns {boolean}
 */
const isValidDateString = (dateStr) => {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  const daysInMonth = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day >= 1 && day <= daysInMonth[month - 1];
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
  if (!isValidDateString(trimmedEventDate)) {
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
 * Server-side validation middleware for partially updating an opportunity
 */
const validateUpdateOpportunity = (req, res, next) => {
  const {
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
  } = req.body || {};

  // Reject empty update body
  const updateKeys = [
    'title',
    'description',
    'category',
    'event_date',
    'start_time',
    'end_time',
    'location',
    'address',
    'capacity',
    'status',
  ];

  const hasAtLeastOneField = updateKeys.some((k) => req.body && req.body[k] !== undefined);
  if (!hasAtLeastOneField) {
    return next(new AppError('At least one field must be provided for update', 400));
  }

  const sanitized = {};

  // 1. Validate title if provided
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return next(new AppError('Opportunity title must be a non-empty string', 400));
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2 || trimmedTitle.length > 255) {
      return next(new AppError('Opportunity title must be between 2 and 255 characters', 400));
    }
    sanitized.title = trimmedTitle;
  }

  // 2. Validate description if provided
  if (description !== undefined) {
    if (description === null) {
      sanitized.description = null;
    } else {
      if (typeof description !== 'string') {
        return next(new AppError('Description must be a valid text string', 400));
      }
      const trimmedDesc = description.trim();
      if (trimmedDesc.length > 5000) {
        return next(new AppError('Description must not exceed 5000 characters', 400));
      }
      sanitized.description = trimmedDesc;
    }
  }

  // 3. Validate category if provided
  if (category !== undefined) {
    if (category === null) {
      sanitized.category = null;
    } else {
      if (typeof category !== 'string') {
        return next(new AppError('Category must be a valid text string', 400));
      }
      const trimmedCat = category.trim();
      if (trimmedCat.length > 100) {
        return next(new AppError('Category must not exceed 100 characters', 400));
      }
      sanitized.category = trimmedCat;
    }
  }

  // 4. Validate event_date if provided
  if (event_date !== undefined) {
    if (typeof event_date !== 'string' || !DATE_REGEX.test(event_date.trim())) {
      return next(new AppError('Event date must be in YYYY-MM-DD format', 400));
    }
    const trimmedEventDate = event_date.trim();
    if (!isValidDateString(trimmedEventDate)) {
      return next(new AppError('Event date must be a valid calendar date', 400));
    }
    sanitized.event_date = trimmedEventDate;
  }

  // 5. Validate start_time if provided
  if (start_time !== undefined) {
    if (typeof start_time !== 'string' || !TIME_REGEX.test(start_time.trim())) {
      return next(new AppError('Start time must be in HH:MM or HH:MM:SS format', 400));
    }
    sanitized.start_time = start_time.trim();
  }

  // 6. Validate end_time if provided
  if (end_time !== undefined) {
    if (typeof end_time !== 'string' || !TIME_REGEX.test(end_time.trim())) {
      return next(new AppError('End time must be in HH:MM or HH:MM:SS format', 400));
    }
    sanitized.end_time = end_time.trim();
  }

  // If both start_time and end_time are provided in the update, cross-validate them here
  if (sanitized.start_time !== undefined && sanitized.end_time !== undefined) {
    if (normalizeTime(sanitized.end_time) < normalizeTime(sanitized.start_time)) {
      return next(new AppError('End time must not be earlier than start time', 400));
    }
  }

  // 7. Validate location if provided
  if (location !== undefined) {
    if (typeof location !== 'string' || !location.trim()) {
      return next(new AppError('Location must be a non-empty string', 400));
    }
    const trimmedLoc = location.trim();
    if (trimmedLoc.length > 255) {
      return next(new AppError('Location must not exceed 255 characters', 400));
    }
    sanitized.location = trimmedLoc;
  }

  // 8. Validate address if provided
  if (address !== undefined) {
    if (address === null) {
      sanitized.address = null;
    } else {
      if (typeof address !== 'string') {
        return next(new AppError('Address must be a valid text string', 400));
      }
      sanitized.address = address.trim();
    }
  }

  // 9. Validate capacity if provided
  if (capacity !== undefined) {
    if (
      capacity === null ||
      typeof capacity !== 'number' ||
      !Number.isInteger(capacity) ||
      capacity <= 0
    ) {
      return next(new AppError('Capacity must be a positive integer greater than 0', 400));
    }
    sanitized.capacity = capacity;
  }

  // 10. Validate status if provided
  if (status !== undefined) {
    if (typeof status !== 'string') {
      return next(new AppError('Status must be a valid string', 400));
    }
    const normalizedStatus = status.trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return next(
        new AppError(
          'Invalid status. Status must be one of: DRAFT, PUBLISHED, COMPLETED, CANCELLED',
          400
        )
      );
    }
    sanitized.status = normalizedStatus;
  }

  // Strip client-supplied ownership or immutable identifiers
  if (req.body) {
    delete req.body.id;
    delete req.body.organization_id;
    delete req.body.coordinator_id;
    delete req.body.created_at;
    delete req.body.updated_at;
  }

  if (req.query) {
    delete req.query.organization_id;
    delete req.query.coordinator_id;
  }

  req.body = sanitized;

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
  normalizeTime,
  isValidDateString,
  validateCreateOpportunity,
  validateUpdateOpportunity,
  validateOpportunityId,
};
