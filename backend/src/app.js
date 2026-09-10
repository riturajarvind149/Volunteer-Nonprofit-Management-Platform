const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Middleware configuration
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Volunteer & Nonprofit Management Platform API is running',
  });
});

// Route registration
app.use('/api/health', healthRoutes);

// Fallback & Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
