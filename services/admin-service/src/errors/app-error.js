/**
 * Operational error class used throughout the service to signal expected
 * failure conditions with a specific HTTP status code.
 */
export default class AppError extends Error {
  /**
   * Creates an operational application error.
   *
   * @param {number} statusCode - HTTP status code to return to the client
   * @param {string} message - Public-facing error description
   * @param {string} [debugInfo] - Optional internal diagnostic information
   */
  constructor(statusCode, message, debugInfo = "") {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.debugInfo = debugInfo;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
