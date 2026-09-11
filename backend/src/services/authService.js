const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

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

module.exports = {
  registerUser,
};
