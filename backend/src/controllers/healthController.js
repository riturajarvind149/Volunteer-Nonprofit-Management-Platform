const pool = require('../config/db');

const getHealth = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api',
  });
};

const getDbHealth = async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({
        status: 'error',
        message: 'Database unavailable: DATABASE_URL is not configured',
      });
    }

    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    // Do not expose database credentials or internal connection details
    res.status(503).json({
      status: 'error',
      message: 'Database unavailable',
    });
  }
};

module.exports = {
  getHealth,
  getDbHealth,
};
