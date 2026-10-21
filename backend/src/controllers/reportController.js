const reportService = require('../services/reportService');

/**
 * Controller for organization reports and exports.
 */

/**
 * Volunteer Participation Report
 * GET /api/reports/volunteer-participation
 */
const getVolunteerParticipationReport = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const { from_date, to_date, format } = req.query;

    const reportData = await reportService.getVolunteerParticipationReport(coordinatorId, {
      from_date,
      to_date,
    });

    if (format === 'csv') {
      const columns = [
        { key: 'volunteer_name', label: 'Volunteer Name' },
        { key: 'volunteer_email', label: 'Email' },
        { key: 'total_signups', label: 'Total Signups' },
        { key: 'events_attended', label: 'Events Attended' },
        { key: 'events_cancelled', label: 'Events Cancelled' },
        { key: 'total_hours_logged', label: 'Total Hours' },
        { key: 'verified_hours', label: 'Verified Hours' },
        { key: 'last_active_date', label: 'Last Active Date' },
      ];
      const csv = reportService.convertToCSV(reportData, columns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="volunteer-participation-report.csv"'
      );
      return res.status(200).send(csv);
    }

    res.status(200).json({
      status: 'success',
      message: 'Volunteer participation report generated successfully',
      data: {
        report: reportData,
        count: reportData.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Volunteer Hours Report
 * GET /api/reports/volunteer-hours
 */
const getVolunteerHoursReport = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const { from_date, to_date, status, format } = req.query;

    const reportData = await reportService.getVolunteerHoursReport(coordinatorId, {
      from_date,
      to_date,
      status,
    });

    if (format === 'csv') {
      const columns = [
        { key: 'volunteer_name', label: 'Volunteer Name' },
        { key: 'volunteer_email', label: 'Email' },
        { key: 'opportunity_title', label: 'Opportunity' },
        { key: 'organization_name', label: 'Organization' },
        { key: 'hours', label: 'Hours' },
        { key: 'status', label: 'Status' },
        { key: 'recorded_at', label: 'Recorded At' },
      ];
      const csv = reportService.convertToCSV(reportData, columns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="volunteer-hours-report.csv"');
      return res.status(200).send(csv);
    }

    res.status(200).json({
      status: 'success',
      message: 'Volunteer hours report generated successfully',
      data: {
        report: reportData,
        count: reportData.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Opportunity Performance Report
 * GET /api/reports/opportunity-performance
 */
const getOpportunityPerformanceReport = async (req, res, next) => {
  try {
    const coordinatorId = req.user.id;
    const { from_date, to_date, format } = req.query;

    const reportData = await reportService.getOpportunityPerformanceReport(coordinatorId, {
      from_date,
      to_date,
    });

    if (format === 'csv') {
      const columns = [
        { key: 'title', label: 'Opportunity Title' },
        { key: 'category', label: 'Category' },
        { key: 'event_date', label: 'Event Date' },
        { key: 'status', label: 'Status' },
        { key: 'capacity', label: 'Capacity' },
        { key: 'active_registrations', label: 'Registrations' },
        { key: 'fill_rate_percentage', label: 'Fill Rate %' },
        { key: 'total_hours_logged', label: 'Total Hours' },
      ];
      const csv = reportService.convertToCSV(reportData, columns);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="opportunity-performance-report.csv"'
      );
      return res.status(200).send(csv);
    }

    res.status(200).json({
      status: 'success',
      message: 'Opportunity performance report generated successfully',
      data: {
        report: reportData,
        count: reportData.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getVolunteerParticipationReport,
  getVolunteerHoursReport,
  getOpportunityPerformanceReport,
};
