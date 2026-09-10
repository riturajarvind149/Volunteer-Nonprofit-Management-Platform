const express = require('express');
const { getHealth, getDbHealth } = require('../controllers/healthController');

const router = express.Router();

router.get('/', getHealth);
router.get('/db', getDbHealth);

module.exports = router;
