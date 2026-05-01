import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

/**
 * Maps MongoDB/Mongoose errors to application HTTP errors.
 *
 * @param {any} err
 * @returns {{statusCode:number,message:string,debugInfo:any}|null}
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
 * Express error handling middleware for the redPlug adapter.
 *
 * @param {any} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
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
    debugInfo: `redPlug Adapter: ${debugInfo}`,
  };

  res.status(statusCode).json(response);
}

export default errorMiddleware;
