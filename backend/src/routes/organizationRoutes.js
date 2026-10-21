const express = require('express');
const organizationController = require('../controllers/organizationController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const {
  validateCreateOrganization,
  validateOrganizationId,
} = require('../middleware/validateOrganization');

const router = express.Router();

/**
 * @route   POST /api/organizations
 * @desc    Create a new organization (Coordinator only)
 * @access  Protected (COORDINATOR)
 */
router.post(
  '/',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateCreateOrganization,
  organizationController.create
);

/**
 * @route   GET /api/organizations
 * @desc    Get all organizations (Volunteers and Coordinators)
 * @access  Protected (VOLUNTEER, COORDINATOR)
 */
router.get(
  '/',
  authenticate,
  authorizeRoles('VOLUNTEER', 'COORDINATOR'),
  organizationController.getAll
);

/**
 * @route   GET /api/organizations/:id
 * @desc    Get an organization by UUID
 * @access  Protected (Any authenticated user)
 */
router.get(
  '/:id',
  authenticate,
  validateOrganizationId,
  organizationController.getById
);

/**
 * @route   PATCH /api/organizations/:id
 * @desc    Update organization profile (Coordinator owner only)
 * @access  Protected (COORDINATOR)
 */
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('COORDINATOR'),
  validateOrganizationId,
  organizationController.update
);

/**
 * @route   GET /api/organizations/:id/impact
 * @desc    Get organization impact summary and metrics
 * @access  Protected (Any authenticated user)
 */
router.get(
  '/:id/impact',
  authenticate,
  validateOrganizationId,
  organizationController.getImpact
);

module.exports = router;
