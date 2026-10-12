const AppError = require('../utils/AppError');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = ['PENDING', 'RECORDED', 'VERIFIED'];

/**
 * Middleware to validate recording volunteer hours
 */
const validateRecordHours = (req, res, next) => {
  const signupId = req.params.signupId || req.params.id;

  // 1. Validate signupId UUID
  if (!signupId || !UUID_REGEX.test(signupId.trim())) {
    return next(new AppError('Invalid signup ID format. Expected a valid UUID', 400));
  }

  const { hours, status } = req.body;

  // 2. Validate hours existence and format
  if (hours === undefined || hours === null) {
    return next(new AppError('Hours is required and must be a valid number', 400));
  }

  if (typeof hours !== 'number' || isNaN(hours) || !isFinite(hours)) {
    return next(new AppError('Hours is required and must be a valid number', 400));
  }

  if (hours < 0) {
    return next(new AppError('Hours must be greater than or equal to 0', 400));
  }

  if (hours > 9999.99) {
    return next(new AppError('Hours must not exceed 9999.99', 400));
  }

  // Verify precision (max 2 decimal places)
  const decimalStr = hours.toString().split('.')[1] || '';
  if (decimalStr.length > 2) {
    return next(new AppError('Hours cannot have more than 2 decimal places', 400));
  }

  // 3. Validate status (optional, defaults to 'RECORDED')
  let normalizedStatus = 'RECORDED';
  if (status !== undefined && status !== null) {
    if (typeof status !== 'string') {
      return next(new AppError('Status must be a valid string', 400));
    }
    normalizedStatus = status.trim().toUpperCase();
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return next(
        new AppError(
          'Invalid status. Status must be one of: PENDING, RECORDED, VERIFIED',
          400
        )
      );
    }
  }

  // 4. Validate optional Idempotency-Key header
  const rawIdempotencyKey = req.headers['idempotency-key'];
  if (rawIdempotencyKey !== undefined) {
    if (Array.isArray(rawIdempotencyKey)) {
      return next(new AppError('Multiple Idempotency-Key headers are not allowed', 400));
    }
    if (typeof rawIdempotencyKey !== 'string' || rawIdempotencyKey.trim().length === 0) {
      return next(new AppError('Idempotency-Key header cannot be empty', 400));
    }
    const trimmedKey = rawIdempotencyKey.trim();
    if (trimmedKey.length > 255) {
      return next(new AppError('Idempotency-Key header must not exceed 255 characters', 400));
    }
    req.idempotencyKey = trimmedKey;
  } else {
    req.idempotencyKey = null;
  }

  // 5. Sanitize req.body to prevent identity spoofing
  if (req.body.recorded_by !== undefined) delete req.body.recorded_by;
  if (req.body.coordinator_id !== undefined) delete req.body.coordinator_id;
  if (req.body.id !== undefined) delete req.body.id;
  if (req.body.idempotency_key !== undefined) delete req.body.idempotency_key;
  if (req.body.idempotencyKey !== undefined) delete req.body.idempotencyKey;

  req.body.hours = hours;
  req.body.status = normalizedStatus;

  next();
};

/**
 * Middleware to validate updating volunteer hours status
 */
const validateUpdateHoursStatus = (req, res, next) => {
  const { id } = req.params;

  // 1. Validate ID UUID format
  if (!id || !UUID_REGEX.test(id.trim())) {
    return next(new AppError('Invalid volunteer hours ID format. Expected a valid UUID', 400));
  }

  const { status } = req.body;

  // 2. Validate status existence and type
  if (status === undefined || status === null) {
    return next(new AppError('Status is required', 400));
  }

  if (typeof status !== 'string' || status.trim() === '') {
    return next(new AppError('Status must be a valid non-empty string', 400));
  }

  const normalizedStatus = status.trim().toUpperCase();
  if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
    return next(
      new AppError(
        'Invalid status. Status must be one of: PENDING, RECORDED, VERIFIED',
        400
      )
    );
  }

  // 3. Sanitize req.body to prevent tampering with other fields
  if (req.body.recorded_by !== undefined) delete req.body.recorded_by;
  if (req.body.coordinator_id !== undefined) delete req.body.coordinator_id;
  if (req.body.volunteer_id !== undefined) delete req.body.volunteer_id;
  if (req.body.signup_id !== undefined) delete req.body.signup_id;
  if (req.body.hours !== undefined) delete req.body.hours;
  if (req.body.id !== undefined) delete req.body.id;

  req.body.status = normalizedStatus;

  next();
};

/**
 * Helper to validate exact YYYY-MM-DD calendar date
 * Rejects impossible dates without auto-correcting
 */
const isValidDateString = (dateStr) => {
  if (typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  return (
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month - 1 &&
    dateObj.getUTCDate() === day
  );
};

/**
 * Middleware to validate optional date range filters (from_date, to_date)
 * For GET /api/hours/organization/opportunities
 */
const validateDateRangeFilter = (req, res, next) => {
  const { from_date, to_date } = req.query;

  if (from_date !== undefined) {
    if (!isValidDateString(from_date)) {
      return next(
        new AppError('Invalid from_date format. Expected a valid YYYY-MM-DD date', 400)
      );
    }
  }

  if (to_date !== undefined) {
    if (!isValidDateString(to_date)) {
      return next(
        new AppError('Invalid to_date format. Expected a valid YYYY-MM-DD date', 400)
      );
    }
  }

  if (from_date && to_date && from_date > to_date) {
    return next(new AppError('from_date cannot be after to_date', 400));
  }

  next();
};

module.exports = {
  validateRecordHours,
  validateUpdateHoursStatus,
  validateDateRangeFilter,
};


