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

module.exports = {
  register,
};
