/**
 * Demo data seed (npm run seed:demo).
 *
 * Seeds the Bengaluru demo data, checks the showcase flows work with it through the API,
 * re-seeds (must replace, not duplicate), then removes it all again.
 */
require('dotenv').config({ quiet: true });
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_ENABLED = 'false';

const app = require('../src/app');
const pool = require('../src/config/db');
const { migrate } = require('../src/db/migrate');
const { seedDemo, removeDemo, DEMO_DOMAIN } = require('../src/scripts/seedDemo');
const statsRoutes = require('../src/routes/statsRoutes');

const c = { green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m' };
let passed = 0;
let failed = 0;
const assert = (cond, label, detail = '') => {
  if (cond) {
    passed++;
    console.log(` ${c.green}✔ PASS${c.reset} - ${label}`);
  } else {
    failed++;
    console.error(` ${c.red}✖ FAIL${c.reset} - ${label}`);
    if (detail) console.error(`        Detail: ${detail}`);
  }
};
const section = (t) => console.log(`\n${c.bold}${c.cyan}--> ${t}${c.reset}`);

let server;
let baseUrl;
const PASSWORD = 'Demo-pass123';
const START = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

const api = async (method, path, { token, body } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
};
const login = async (name) => {
  const res = await api('POST', '/api/auth/login', { body: { email: `${name}@${DEMO_DOMAIN}`, password: PASSWORD } });
  return res.data.data?.token;
};

const run = async () => {
  console.log(`${c.bold}${c.cyan}DEMO SEED SUITE${c.reset}`);
  await migrate({ log: () => {} });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://localhost:${server.address().port}`;
      resolve();
    });
  });

  section('Seeding');
  let weakRejected = false;
  try {
    await seedDemo({ password: 'short', start: START });
  } catch {
    weakRejected = true;
  }
  assert(weakRejected, 'A weak DEMO_PASSWORD is rejected');

  const result = await seedDemo({ password: PASSWORD, start: START });
  assert(result.organizations === 5 && result.accounts === 18 && result.opportunities === 21, 'Seed creates NGOs, accounts and events', JSON.stringify(result));
  const { rows: cities } = await pool.query("SELECT DISTINCT city FROM organizations WHERE email LIKE $1", [`%@${DEMO_DOMAIN}`]);
  assert(cities.length === 1 && cities[0].city === 'Bengaluru', 'Every demo NGO is in Bengaluru');

  const { rows: perDay } = await pool.query(
    `SELECT o.event_date::text AS day, COUNT(*)::int AS n FROM opportunities o
       JOIN organizations org ON org.id = o.organization_id
      WHERE org.email LIKE $1 AND o.event_date BETWEEN $2::date AND $2::date + 7 AND o.status = 'PUBLISHED'
      GROUP BY 1`,
    [`%@${DEMO_DOMAIN}`, START]
  );
  assert(perDay.length === 8, 'There is a published event on each of the 8 demo days', JSON.stringify(perDay));

  section('Public impact numbers');
  statsRoutes.clearCache();
  const impact = await api('GET', '/api/stats/impact');
  const numbers = impact.data.data?.impact || {};
  assert(impact.status === 200 && numbers.volunteers >= 10 && numbers.verified_hours > 50 && numbers.organizations >= 4 && numbers.events_completed >= 6,
    'Home page impact numbers include the demo data', JSON.stringify(numbers));
  assert(Object.keys(numbers).every((k) => typeof numbers[k] === 'number'), 'Impact only returns totals');

  section('Showcase flows work with the demo accounts');
  const priya = await login('priya');
  assert(Boolean(priya), 'Volunteer can sign in with DEMO_PASSWORD');

  const mine = await api('GET', '/api/signups/my', { token: priya });
  assert(mine.status === 200 && mine.data.data?.signups?.length >= 10, 'Volunteer has a history of registrations', String(mine.data.data?.signups?.length));

  const cert = await fetch(`${baseUrl}/api/hours/my/certificate`, { headers: { Authorization: `Bearer ${priya}` } });
  assert(cert.status === 200 && /pdf/.test(cert.headers.get('content-type') || ''), 'Volunteer can download a certificate of verified hours');

  const waitlist = await api('GET', '/api/signups/my/waitlist', { token: priya });
  assert(waitlist.data.data?.waitlist?.length === 1, 'Volunteer is on one waitlist', JSON.stringify(waitlist.data).slice(0, 200));

  const browse = await api('GET', `/api/opportunities?upcoming=true&q=Bellandur`);
  const bellandur = browse.data.data?.opportunities?.[0];
  assert(bellandur && bellandur.organization_name === 'Namma Bengaluru Green Trust', 'Demo events are publicly listed');

  const night = await api('GET', `/api/opportunities?upcoming=true&q=Majestic`);
  assert(night.data.data?.opportunities?.[0]?.ends_next_day === true, 'The night food distribution ends the next day');

  const full = (await api('GET', `/api/opportunities?upcoming=true&q=adoption`)).data.data?.opportunities?.[0];
  assert(full && Number(full.spots_remaining) === 0 && full.waitlist_count === 2, 'The adoption drive is full with 2 on the waitlist', JSON.stringify(full));

  const arjun = await login('arjun');
  const review = await api('GET', '/api/hours/organization?status=PENDING,RECORDED&page=1&limit=25', { token: arjun });
  assert(review.status === 200 && review.data.data?.pagination?.total > 0, 'NGO admin has hours waiting for review');
  const team = await api('GET', `/api/organizations/${bellandur?.organization_id}/team`, { token: arjun });
  assert(team.data.data?.members?.length === 2, 'Green Trust has its NGO admin and a coordinator');

  const kavya = await login('kavya');
  const analytics = await api('GET', '/api/analytics/coordinator', { token: kavya });
  assert(analytics.status === 200, 'Coordinator analytics load');

  const { rows: pending } = await pool.query(
    "SELECT name FROM organizations WHERE email LIKE $1 AND verification_status = 'PENDING'",
    [`%@${DEMO_DOMAIN}`]
  );
  assert(pending.length === 1 && pending[0].name === 'Sahaya Elder Care Society', 'One NGO waits for admin review');

  const { rows: mailOn } = await pool.query('SELECT COUNT(*)::int AS n FROM users WHERE email LIKE $1 AND email_notifications', [`%@${DEMO_DOMAIN}`]);
  assert(mailOn[0].n === 0, 'Demo accounts have email notifications off');

  section('Re-seeding and removing');
  await seedDemo({ password: PASSWORD, start: START });
  const { rows: again } = await pool.query('SELECT COUNT(*)::int AS n FROM organizations WHERE email LIKE $1', [`%@${DEMO_DOMAIN}`]);
  assert(again[0].n === 5, 'Running the seed again replaces the demo data instead of duplicating it');

  const removed = await removeDemo();
  assert(removed.organizations === 5 && removed.users === 18, 'Remove deletes every demo NGO and account', JSON.stringify(removed));
  const { rows: left } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM users WHERE email LIKE $1)::int AS users,
            (SELECT COUNT(*) FROM organizations WHERE email LIKE $1)::int AS orgs`,
    [`%@${DEMO_DOMAIN}`]
  );
  assert(left[0].users === 0 && left[0].orgs === 0, 'Nothing demo is left behind');
};

run()
  .catch((err) => {
    failed++;
    console.error('Unexpected failure:', err);
  })
  .finally(async () => {
    try {
      await removeDemo();
    } catch (err) {
      console.error('Cleanup error:', err.message);
    }
    if (server) server.close();
    await pool.end();
    console.log(`\n${c.bold}DEMO SEED: ${passed} PASSED | ${failed} FAILED${c.reset}`);
    process.exit(failed ? 1 : 0);
  });
