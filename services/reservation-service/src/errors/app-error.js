/**
 * Operational error class used throughout the service to signal known, handled failures.
 *
 * Instances are distinguished from unexpected system errors by the `isOperational` flag,
 * which the error middleware uses to decide whether to expose details in the response.
 */
export default class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP status code to return to the client
   * @param {string} message - Public-facing error description sent in the response body
   * @param {string} [debugInfo] - Optional internal detail for debugging (not always surfaced to clients)
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
