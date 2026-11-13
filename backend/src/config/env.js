/**
 * Centralised runtime configuration.
 *
 * Values are read lazily (functions/getters) so that tests can toggle
 * environment variables at runtime without re-requiring modules.
 */

const bool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const int = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction() {
    return this.nodeEnv === 'production';
  },
  get isTest() {
    return this.nodeEnv === 'test';
  },
  get appName() {
    return process.env.APP_NAME || 'ServeHub';
  },
  /** Public URL of the frontend, used to build links inside emails. */
  get appUrl() {
    const explicit = process.env.APP_URL;
    if (explicit) return explicit.replace(/\/+$/, '');
    const first = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    return (first || 'http://localhost:5173').replace(/\/+$/, '');
  },
  get jwtSecret() {
    return process.env.JWT_SECRET;
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '7d';
  },
  /** Require users to verify their email before they can log in. */
  get requireEmailVerification() {
    return bool(process.env.REQUIRE_EMAIL_VERIFICATION, true);
  },
  /** Require an admin to approve an organization before it can publish opportunities. */
  get requireOrgApproval() {
    return bool(process.env.REQUIRE_ORG_APPROVAL, true);
  },
  get rateLimitEnabled() {
    return bool(process.env.RATE_LIMIT_ENABLED, !this.isTest);
  },
  get timezone() {
    return process.env.APP_TIMEZONE || 'Asia/Kolkata';
  },
  get reminderLeadHours() {
    return int(process.env.REMINDER_LEAD_HOURS, 24);
  },
  get trustProxy() {
    return int(process.env.TRUST_PROXY_HOPS, 1);
  },
  get logLevel() {
    return process.env.LOG_LEVEL || (this.isTest ? 'silent' : 'info');
  },
  smtp: {
    get host() {
      return process.env.SMTP_HOST;
    },
    get port() {
      return int(process.env.SMTP_PORT, 587);
    },
    get secure() {
      return bool(process.env.SMTP_SECURE, false);
    },
    get user() {
      return process.env.SMTP_USER;
    },
    get pass() {
      return process.env.SMTP_PASS;
    },
    get from() {
      return process.env.EMAIL_FROM || 'ServeHub <no-reply@servehub.local>';
    },
  },
};

/**
 * Fail fast on missing / unsafe configuration. Called once at server start.
 */
const validateEnv = () => {
  const errors = [];

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (config.isProduction && config.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }

  if (config.isProduction && !process.env.FRONTEND_URL) {
    errors.push('FRONTEND_URL is required in production (used for CORS and email links)');
  }

  if (config.isProduction && !config.smtp.host) {
    // Not fatal: the app still works, but emails are only logged.
    console.warn('[config] SMTP_HOST is not set — emails will be logged instead of sent.');
  }

  if (errors.length) {
    const message = `Invalid configuration:\n - ${errors.join('\n - ')}`;
    throw new Error(message);
  }
};

module.exports = { config, validateEnv };
