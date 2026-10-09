const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const opportunityRoutes = require('./routes/opportunityRoutes');
const signupRoutes = require('./routes/signupRoutes');
const volunteerHoursRoutes = require('./routes/volunteerHoursRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Build the allowed-origins list from environment.
// FRONTEND_URL supports a single URL or comma-separated list for multiple deployments.
const buildAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URL || '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
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
};

// Middleware configuration
app.use(cors(corsOptions));
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Volunteer & Nonprofit Management Platform API is running',
  });
});

// Route registration
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/signups', signupRoutes);
app.use('/api/hours', volunteerHoursRoutes);

// Fallback & Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
