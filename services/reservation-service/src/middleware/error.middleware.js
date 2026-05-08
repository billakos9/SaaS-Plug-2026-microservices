import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

/**
 * Maps known Mongoose error types to a structured error descriptor.
 *
 * Handles ValidationError, CastError, and duplicate-key (code 11000) errors.
 * Returns null for any error that is not a recognised Mongoose error so the
 * caller can fall through to a generic internal-server-error response.
 *
 * @param {Error|null} err - The error to inspect
 * @returns {{ statusCode: number, message: string, debugInfo: any }|null} Structured error descriptor, or null if not a Mongoose error
 */
function mapMongoError(err) {
  if (!err) return null;

  if (err.name === "ValidationError") {
    return {
      statusCode: HttpCode.BAD_REQUEST,
      message:    "Validation failed",
      debugInfo:  Object.values(err.errors).map((e) => e.message),
    };
  }

  if (err.name === "CastError") {
    return {
      statusCode: HttpCode.BAD_REQUEST,
      message:    `Invalid ${err.path}`,
      debugInfo:  err.value,
    };
  }

  if (err.code === 11000) {
    return {
      statusCode: HttpCode.SERVER_ERROR,
      message:    "Duplicate key error",
      debugInfo:  err.keyValue,
    };
  }

  return null;
}

/**
 * Global error-handling middleware. Converts AppError and Mongoose errors into
 * a consistent JSON error response; logs unexpected system errors to the console.
 *
 * @param {Error} err - The error passed to next(err) by a route or earlier middleware
 * @param {import("express").Request} req - Express request (used for originator/URL metadata)
 * @param {import("express").Response} res - Express response; sends a JSON error body with statusCode
 * @param {import("express").NextFunction} next - Express next function (required by Express to recognise this as error middleware; unused)
 */
// eslint-disable-next-line no-unused-vars
export default function errorMiddleware(err, req, res, next) {
  let statusCode = HttpCode.SERVER_ERROR;
  let message    = "Internal server error";
  let debugInfo  = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message    = err.message;
    debugInfo  = err.debugInfo;
  } else {
    const mongoError = mapMongoError(err);
    if (mongoError) {
      statusCode = mongoError.statusCode;
      message    = mongoError.message;
      debugInfo  = mongoError.debugInfo;
    } else {
      console.error("Internal System Error:", err);
      message = "An unexpected error occurred";
    }
  }

  res.status(statusCode).json({
    call:       req.originalUrl,
    timeRef:    new Date(),
    originator: req.ip,
    returnCode: statusCode,
    error:      message,
    debugInfo,
  });
}
