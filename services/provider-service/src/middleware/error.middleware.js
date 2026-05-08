import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

/**
 * Maps Mongoose/MongoDB errors into a standardised error shape.
 *
 * Handles ValidationError, CastError, and duplicate-key (code 11000) errors.
 * Returns null for any error that is not a recognised Mongoose/MongoDB error.
 *
 * @param {any} err - The error object to inspect.
 * @returns {{ statusCode: number, message: string, debugInfo: any } | null} Mapped error object, or null if not a Mongo error.
 */
function mapMongoError(err) {
  if (!err) return null;

  if (err.name === "ValidationError") {
    return {
      statusCode: HttpCode.BAD_REQUEST,
      message: "Validation failed",
      debugInfo: Object.values(err.errors).map((e) => e.message),
    };
  }

  if (err.name === "CastError") {
    return {
      statusCode: HttpCode.BAD_REQUEST,
      message: `Invalid ${err.path}`,
      debugInfo: err.value,
    };
  }

  if (err.code === 11000) {
    return {
      statusCode: HttpCode.SERVER_ERROR,
      message: "Duplicate key error",
      debugInfo: err.keyValue,
    };
  }

  return null;
}

/**
 * Global error-handling middleware.
 *
 * Transforms AppError instances and Mongoose/MongoDB errors into a unified JSON
 * error response. Unexpected errors are logged to the console before responding.
 *
 * @param {any} err - The error object forwarded by Express or a previous middleware.
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @param {import("express").NextFunction} next - Express next callback (required by Express to recognise 4-arity error handlers).
 * @returns {void}
 */
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  let statusCode = HttpCode.SERVER_ERROR;
  let message = "Internal server error";
  let debugInfo = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    debugInfo = err.debugInfo;
  } else {
    const mongoError = mapMongoError(err);

    if (mongoError) {
      statusCode = mongoError.statusCode;
      message = mongoError.message;
      debugInfo = mongoError.debugInfo;
    } else {
      console.error("Internal System Error:", err);
      message = "An unexpected error occurred";
    }
  }

  const response = {
    call: req.originalUrl,
    timeRef: new Date(),
    originator: req.ip,
    returnCode: statusCode,
    error: message,
    debugInfo,
  };

  res.status(statusCode).json(response);
}

export default errorMiddleware;
