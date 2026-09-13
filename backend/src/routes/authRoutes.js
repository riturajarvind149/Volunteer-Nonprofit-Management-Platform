const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const validateRegister = require('../middleware/validateRegister');
const validateLogin = require('../middleware/validateLogin');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authenticate, getMe);

module.exports = router;
