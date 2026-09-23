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

  // 4. Sanitize req.body to prevent identity spoofing
  if (req.body.recorded_by !== undefined) delete req.body.recorded_by;
  if (req.body.coordinator_id !== undefined) delete req.body.coordinator_id;
  if (req.body.id !== undefined) delete req.body.id;

  req.body.hours = hours;
  req.body.status = normalizedStatus;

  next();
};

module.exports = {
  validateRecordHours,
};
