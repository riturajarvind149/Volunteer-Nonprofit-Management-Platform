const { Pool } = require('pg');

/**
 * Resolve PostgreSQL SSL configuration based on environment variables.
 *
 * Rules:
 * 1. DATABASE_SSL='false' or '0' explicitly disables SSL.
 * 2. DATABASE_SSL='true' or '1' explicitly enables SSL.
 * 3. In production (NODE_ENV === 'production'), SSL is enabled by default to
 *    support managed PostgreSQL providers (such as Render, Supabase, Neon).
 * 4. In development/testing, SSL is disabled by default unless DATABASE_SSL='true'.
 * 5. DATABASE_SSL_REJECT_UNAUTHORIZED='true' enables strict CA certificate validation.
 *    By default in production, rejectUnauthorized is false to support cloud providers
 *    that use self-signed or internal CA certificate chains.
 * 6. DATABASE_CA_CERT can optionally provide a custom CA certificate.
 *
 * @param {Object} [env=process.env]
 * @returns {Object|false} SSL config object or false
 */
const getSslConfig = (env = process.env) => {
  if (env.DATABASE_SSL === 'false' || env.DATABASE_SSL === '0') {
    return false;
  }

  const isExplicitlyEnabled = env.DATABASE_SSL === 'true' || env.DATABASE_SSL === '1';
  const isProduction = env.NODE_ENV === 'production';

  if (isExplicitlyEnabled || isProduction) {
    const rejectUnauthorized = env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
    const ssl = { rejectUnauthorized };
    if (env.DATABASE_CA_CERT) {
      ssl.ca = env.DATABASE_CA_CERT;
    }
    return ssl;
  }

  return false;
};

const sslConfig = getSslConfig();

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (sslConfig !== false) {
  poolConfig.ssl = sslConfig;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

pool.getSslConfig = getSslConfig;

module.exports = pool;
