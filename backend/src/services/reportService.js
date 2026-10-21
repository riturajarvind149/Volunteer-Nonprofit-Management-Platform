const reportRepository = require('../repositories/reportRepository');
const AppError = require('../utils/AppError');

/**
 * Service layer for report generation and exports.
 */

/**
 * Convert array of objects to RFC 4180 compliant CSV string
 * @param {Array<Object>} rows
 * @param {Array<{ key: string, label: string }>} columns
 * @returns {string} CSV string
 */
const convertToCSV = (rows, columns) => {
  if (!rows || rows.length === 0) {
    return columns.map((c) => `"${c.label}"`).join(',') + '\n';
  }

  const headerLine = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rowLines = rows.map((row) => {
    return columns
      .map((col) => {
        let val = row[col.key];
        if (val === null || val === undefined) val = '';
        if (val instanceof Date) val = val.toISOString();
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(',');
  });

  return [headerLine, ...rowLines].join('\n');
};

/**
 * Generate volunteer participation report
 * @param {string} coordinatorId
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
const getVolunteerParticipationReport = async (coordinatorId, filters = {}) => {
  if (!coordinatorId) throw new AppError('Coordinator ID is required', 400);
  return await reportRepository.getVolunteerParticipationReport(coordinatorId, filters);
};

/**
 * Generate volunteer hours report
 * @param {string} coordinatorId
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
const getVolunteerHoursReport = async (coordinatorId, filters = {}) => {
  if (!coordinatorId) throw new AppError('Coordinator ID is required', 400);
  return await reportRepository.getVolunteerHoursReport(coordinatorId, filters);
};

/**
 * Generate opportunity performance report
 * @param {string} coordinatorId
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
const getOpportunityPerformanceReport = async (coordinatorId, filters = {}) => {
  if (!coordinatorId) throw new AppError('Coordinator ID is required', 400);
  return await reportRepository.getOpportunityPerformanceReport(coordinatorId, filters);
};

module.exports = {
  getVolunteerParticipationReport,
  getVolunteerHoursReport,
  getOpportunityPerformanceReport,
  convertToCSV,
};
