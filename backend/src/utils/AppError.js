class AppError extends Error {
  /**
   * @param {string} message - Safe, user-facing message
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Optional machine-readable error code (e.g. EMAIL_NOT_VERIFIED)
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code) this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
