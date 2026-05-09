export default class AppError extends Error {
  constructor(statusCode, message, debugInfo = null) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.debugInfo = debugInfo;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
