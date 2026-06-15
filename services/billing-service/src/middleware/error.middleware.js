import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

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
    return { statusCode: HttpCode.BAD_REQUEST, message: `Invalid ${err.path}`, debugInfo: err.value };
  }
  if (err.code === 11000) {
    return { statusCode: HttpCode.SERVER_ERROR, message: "Duplicate key error", debugInfo: err.keyValue };
  }
  return null;
}

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
