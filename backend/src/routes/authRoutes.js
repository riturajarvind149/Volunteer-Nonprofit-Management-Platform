const express = require('express');
const {
  register,
  login,
  getMe,
  coordinatorTest,
  volunteerTest,
} = require('../controllers/authController');
const validateRegister = require('../middleware/validateRegister');
const validateLogin = require('../middleware/validateLogin');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authenticate, getMe);

// Role-based authorization demonstration endpoints
router.get('/coordinator-test', authenticate, authorizeRoles('COORDINATOR'), coordinatorTest);
router.get('/volunteer-test', authenticate, authorizeRoles('VOLUNTEER'), volunteerTest);

module.exports = router;

