const pool = require('../config/db');

/**
 * Data-access repository for users table
 * Uses parameterized queries to prevent SQL injection
 */

const findByEmail = async (email) => {
  const query = `
    SELECT id, full_name, email, password_hash, role, created_at, updated_at
    FROM users
    WHERE email = $1
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

const findById = async (id) => {
  const query = `
    SELECT id, full_name, email, role, created_at, updated_at
    FROM users
    WHERE id = $1
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const createUser = async ({ full_name, email, password_hash, role }) => {
  const query = `
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, full_name, email, role, created_at, updated_at
  `;
  const values = [full_name, email, password_hash, role];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

module.exports = {
  findByEmail,
  findById,
  createUser,
};
