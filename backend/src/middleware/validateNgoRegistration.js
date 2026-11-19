const AppError = require('../utils/AppError');
const { isSafeHttpUrl, EMAIL_REGEX } = require('../utils/validators');

const REGISTRATION_TYPES = ['TRUST', 'SOCIETY', 'SECTION_8', 'OTHER'];
const PHONE_REGEX = /^\+?[0-9][0-9 ()-]{6,19}$/;
const REGISTRATION_NUMBER_REGEX = /^[A-Za-z0-9][A-Za-z0-9 /.-]{1,59}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

const TEXT_FIELDS = { name: 'NGO name', description: 'Description', registration_type: 'Type of NGO', registration_number: 'Registration number', city: 'City', website: 'Website' };

/**
 * Validate and clean the NGO part of a registration.
 * @returns {{name, description, registration_type, registration_number, city, website}}
 * @throws {AppError} 400 with a message naming the field
 */
const cleanNgoDetails = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('NGO details are required', 400);
  }
  for (const [field, label] of Object.entries(TEXT_FIELDS)) {
    if (input[field] !== undefined && input[field] !== null && typeof input[field] !== 'string') {
      throw new AppError(`${label} must be text`, 400);
    }
  }
  const name = text(input.name);
  if (name.length < 2 || name.length > 255) {
    throw new AppError('NGO name must be between 2 and 255 characters', 400);
  }
  const description = text(input.description);
  if (description.length > 2000) {
    throw new AppError('Description must not exceed 2000 characters', 400);
  }
  const registrationType = text(input.registration_type).toUpperCase();
  if (!REGISTRATION_TYPES.includes(registrationType)) {
    throw new AppError('Choose the type of NGO: Trust, Society, Section 8 company or Other', 400);
  }
  const registrationNumber = text(input.registration_number);
  if (registrationNumber && !REGISTRATION_NUMBER_REGEX.test(registrationNumber)) {
    throw new AppError('Registration number may contain letters, numbers, spaces and / . - only', 400);
  }
  const city = text(input.city);
  if (city.length < 2 || city.length > 100) {
    throw new AppError('City is required', 400);
  }
  const website = text(input.website);
  if (website && !isSafeHttpUrl(website)) {
    throw new AppError('Website must be a full address starting with http:// or https://', 400);
  }
  return {
    name,
    description: description || null,
    registration_type: registrationType,
    registration_number: registrationNumber || null,
    city,
    website: website || null,
  };
};

/** POST /api/organizations — a signed-in coordinator registers their NGO. Body: NGO fields. */
const validateNgoDetails = (req, res, next) => {
  try {
    req.ngo = cleanNgoDetails(req.body);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/register-organization — public NGO sign-up.
 * Body: { full_name, email, password, phone, organization: { ...NGO fields } }
 */
const validateNgoSignup = (req, res, next) => {
  try {
    const { full_name, email, password, phone, organization } = req.body || {};
    const name = text(full_name);
    if (name.length < 2 || name.length > 255) {
      throw new AppError('Your full name must be between 2 and 255 characters', 400);
    }
    const cleanEmail = text(email).toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 255) {
      throw new AppError('Please provide a valid email address', 400);
    }
    if (typeof password !== 'string' || !password) {
      throw new AppError('Password is required', 400);
    }
    const cleanPhone = text(phone);
    if (!PHONE_REGEX.test(cleanPhone)) {
      throw new AppError('Enter a valid phone number so the ServeHub team can reach your NGO', 400);
    }
    req.representative = { full_name: name, email: cleanEmail, password, phone: cleanPhone };
    req.ngo = cleanNgoDetails(organization);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validateNgoDetails, validateNgoSignup };
