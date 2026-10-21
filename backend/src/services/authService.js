const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = '24h';

/**
 * Generate a signed JWT containing minimal, non-sensitive claims
 */
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is not configured on the server', 500);
  }

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
};

/**
 * Service to handle user registration business logic
 */
const registerUser = async ({ full_name, email, password, role }) => {
  // 1. Check if email is already taken (Application-level validation)
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new AppError('Email is already registered', 409);
  }

  // 2. Hash password with bcrypt (10 salt rounds)
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // 3. Persist to database via repository
  try {
    const newUser = await userRepository.createUser({
      full_name,
      email,
      password_hash,
      role,
    });

    // Ensure password_hash is never exposed
    delete newUser.password_hash;

    return newUser;
  } catch (error) {
    // Handle database-level UNIQUE constraint violation (code 23505)
    if (error.code === '23505') {
      throw new AppError('Email is already registered', 409);
    }
    throw error;
  }
};

/**
 * Service to handle user login business logic
 */
const loginUser = async ({ email, password }) => {
  // 1. Find user by email
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Generic error to prevent user enumeration attacks
    throw new AppError('Invalid email or password', 401);
  }

  // 2. Compare password with bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    // Identical generic error
    throw new AppError('Invalid email or password', 401);
  }

  // 3. Generate JWT access token
  const token = generateToken(user);

  // 4. Strip sensitive password_hash before returning
  delete user.password_hash;

  return {
    token,
    user,
  };
};

/**
 * Service to retrieve authenticated user profile by ID
 */
const getUserProfile = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

/**
 * Service to change authenticated user's password
 * @param {string} userId - User UUID
 * @param {string} currentPassword - Current plaintext password
 * @param {string} newPassword - New plaintext password
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters long', 400);
  }

  const currentHash = await userRepository.findPasswordHashById(userId);
  if (!currentHash) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, currentHash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await userRepository.updatePassword(userId, newHash);

  return { message: 'Password updated successfully' };
};

module.exports = {
  registerUser,
  loginUser,
  generateToken,
  getUserProfile,
  changePassword,
};

