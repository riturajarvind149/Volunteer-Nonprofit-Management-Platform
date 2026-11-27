const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// The numbers change slowly; cache them so the home page can't be used to load the database.
const CACHE_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

/**
 * Platform-wide impact for the public home page. Only totals, nothing about any person.
 * Counts only what the public can see: verified hours, approved NGOs, completed events.
 */
const loadImpact = async () => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(DISTINCT s.volunteer_id)::int
         FROM volunteer_hours vh JOIN signups s ON s.id = vh.signup_id
        WHERE vh.status = 'VERIFIED') AS volunteers,
      (SELECT COALESCE(SUM(hours), 0)::float FROM volunteer_hours WHERE status = 'VERIFIED') AS verified_hours,
      (SELECT COUNT(*)::int FROM organizations WHERE verification_status = 'APPROVED') AS organizations,
      (SELECT COUNT(*)::int FROM opportunities o JOIN organizations org ON org.id = o.organization_id
        WHERE o.status = 'COMPLETED' AND org.verification_status = 'APPROVED') AS events_completed,
      (SELECT COUNT(*)::int FROM opportunities o JOIN organizations org ON org.id = o.organization_id
        WHERE o.status = 'PUBLISHED' AND o.event_date >= CURRENT_DATE
          AND org.verification_status = 'APPROVED') AS open_opportunities
  `);
  return rows[0];
};

/** GET /api/stats/impact — public */
router.get('/impact', async (req, res, next) => {
  try {
    if (!cached || Date.now() - cachedAt > CACHE_MS) {
      cached = await loadImpact();
      cachedAt = Date.now();
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ status: 'success', data: { impact: cached } });
  } catch (err) {
    next(err);
  }
});

/** Tests change data between requests; let them read fresh numbers. */
router.clearCache = () => {
  cached = null;
};

module.exports = router;
