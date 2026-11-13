const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const crypto = require('crypto');

const { config } = require('./config/env');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiters');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const signupRoutes = require('./routes/signupRoutes');
const volunteerHoursRoutes = require('./routes/volunteerHoursRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Running behind a reverse proxy (Render, Railway, Nginx...) — needed for correct client IPs in rate limiting.
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

// Build the allowed-origins list from environment.
// FRONTEND_URL supports a single URL or comma-separated list for multiple deployments.
const buildAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // Always allow localhost in non-production for developer convenience
  if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000'].forEach((o) => {
      if (!origins.includes(o)) origins.push(o);
    });
  }

  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = buildAllowedOrigins();
    // Allow requests with no origin (mobile apps, curl, same-origin server calls)
    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: Origin '${origin}' is not allowed`));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
};

// --- Request logging with correlation id ---
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && incoming.length <= 100 ? incoming : crypto.randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url.startsWith('/api/health') },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// --- Security & performance middleware ---
app.use(
  helmet({
    // API only serves JSON / files; lock everything down.
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
// Express 5 leaves req.body undefined when no body is sent; normalise for validators.
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null || typeof req.body !== 'object') req.body = {};
  next();
});
app.use('/api', apiLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Volunteer & Nonprofit Management Platform API is running',
  });
});

// Route registration
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/signups', signupRoutes);
app.use('/api/hours', volunteerHoursRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Fallback & Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
