const AppError = require('./AppError');
const { config } = require('../config/env');

/**
 * Identity details a volunteer must provide (once, on their profile) before
 * they can register for an opportunity, so a platform admin can check that
 * they are a real person.
 */

const ID_TYPES = ['AADHAAR', 'PAN', 'VOTER_ID', 'DRIVING_LICENCE', 'PASSPORT', 'OTHER'];

/** Required fields → human-readable label (used in error messages). */
const REQUIRED_DETAILS = {
  full_name: 'full name',
  phone: 'phone number',
  location: 'city',
  date_of_birth: 'date of birth',
  emergency_contact_name: 'emergency contact name',
  emergency_contact_phone: 'emergency contact phone',
};

/** Fields whose change means an admin should look at the volunteer again. */
const IDENTITY_FIELDS = ['full_name', 'phone', 'date_of_birth', 'id_type', 'id_last4'];

const MIN_AGE = 13;
const MAX_AGE = 120;

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Returns the list of required detail keys that are still missing. */
const missingVolunteerDetails = (user) =>
  Object.keys(REQUIRED_DETAILS).filter((key) => isBlank(user?.[key]));

/**
 * Throws if this volunteer may not register / join a waitlist yet:
 *  - 403 VOLUNTEER_FLAGGED when an admin flagged the account
 *  - 400 PROFILE_INCOMPLETE when required details are missing
 */
const assertVolunteerCanRegister = (user) => {
  if (!config.requireVolunteerDetails) return;
  if (!user) throw new AppError('User not found', 404);
  if (user.verification_status === 'FLAGGED') {
    throw new AppError(
      'Your account is under review by the ServeHub team, so you can’t register for new opportunities right now. Please contact support.',
      403,
      'VOLUNTEER_FLAGGED'
    );
  }
  const missing = missingVolunteerDetails(user);
  if (missing.length) {
    const err = new AppError(
      `Please complete your details before registering: ${missing.map((k) => REQUIRED_DETAILS[k]).join(', ')}.`,
      400,
      'PROFILE_INCOMPLETE'
    );
    err.missing = missing;
    throw err;
  }
};

/** Validates a YYYY-MM-DD date of birth; returns the normalised string. */
const parseDateOfBirth = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new AppError('Date of birth must be a date in YYYY-MM-DD format', 400);
  }
  const text = value.trim();
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new AppError('Date of birth is not a valid date', 400);
  }
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d)) age -= 1;
  if (age < MIN_AGE || age > MAX_AGE) {
    throw new AppError(`Volunteers must be between ${MIN_AGE} and ${MAX_AGE} years old`, 400);
  }
  return text;
};

module.exports = {
  ID_TYPES,
  REQUIRED_DETAILS,
  IDENTITY_FIELDS,
  missingVolunteerDetails,
  assertVolunteerCanRegister,
  parseDateOfBirth,
};
