/**
 * Application-level error wrapper that carries HTTP semantics.
 */
export default class AppError extends Error {
  /**
   * Creates an application-level error.
   *
   * @param {number} statusCode - HTTP status code to return.
   * @param {string} message - Public error description.
   * @param {string} [debugInfo] - Internal debug details.
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
