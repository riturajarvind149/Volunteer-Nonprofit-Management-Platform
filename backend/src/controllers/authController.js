const authService = require('../services/authService');

/**
 * Controller for user registration
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { full_name, email, password, role } = req.body;

    const user = await authService.registerUser({
      full_name,
      email,
      password,
      role,
    });

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for user login
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { token, user } = await authService.loginUser({
      email,
      password,
    });

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for retrieving authenticated user info
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getUserProfile(req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'Authenticated user profile retrieved',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Demonstration controller for coordinator-only access
 * GET /api/auth/coordinator-test
 */
const coordinatorTest = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Coordinator authorization successful',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Demonstration controller for volunteer-only access
 * GET /api/auth/volunteer-test
 */
const volunteerTest = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Volunteer authorization successful',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  coordinatorTest,
  volunteerTest,
};
