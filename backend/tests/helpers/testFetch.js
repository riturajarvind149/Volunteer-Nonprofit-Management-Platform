/**
 * Test fixture: a drop-in `fetch` for suites that need coordinator accounts and NGOs
 * as setup, but aren't testing sign-up itself.
 *
 *  - POST /api/auth/register with role COORDINATOR: coordinators can no longer sign up
 *    publicly (NGOs appoint them), so the account is created directly in the database,
 *    verified and active, and a 201 response like the real endpoint's is returned.
 *  - POST /api/organizations without registration_type / city: those NGO details are
 *    filled with neutral test values.
 *
 * Every other request goes to the real API unchanged. Suites that test registration
 * (test_registration, test_ngo_registration) use the real `fetch` instead.
 *
 * Usage:  const fetch = require('./helpers/testFetch');
 */
const bcrypt = require('bcrypt');
const pool = require('../../src/config/db');

const realFetch = globalThis.fetch;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const parseBody = (options) => {
  try {
    return typeof options?.body === 'string' ? JSON.parse(options.body) : null;
  } catch {
    return null;
  }
};

const createCoordinator = async ({ full_name, email, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length) {
    return json(409, { status: 'error', message: 'Email is already registered' });
  }
  const hash = await bcrypt.hash(String(password), 4);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, email_verified_at)
     VALUES ($1, $2, $3, 'COORDINATOR', NOW())
     RETURNING id, full_name, email, role, email_verified_at, created_at`,
    [String(full_name || '').trim(), normalizedEmail, hash]
  );
  return json(201, { status: 'success', message: 'User registered successfully', data: { user: rows[0] } });
};

const testFetch = async (url, options = {}) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const method = (options.method || 'GET').toUpperCase();
  const body = parseBody(options);

  if (method === 'POST' && path === '/api/auth/register' && String(body?.role || '').toUpperCase() === 'COORDINATOR') {
    return createCoordinator(body);
  }
  if (method === 'POST' && path === '/api/organizations' && body && typeof body === 'object') {
    const withDefaults = { registration_type: 'OTHER', city: 'Test City', ...body };
    return realFetch(url, { ...options, body: JSON.stringify(withDefaults) });
  }
  return realFetch(url, options);
};

module.exports = testFetch;
