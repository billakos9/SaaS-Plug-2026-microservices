import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Handles requests that do not match any registered route.
 *
 * This middleware is executed only after all route modules have been evaluated.
 * It forwards a standardized "not found" error to the centralized error handler.
 *
 * @param {import("express").Request} req - The incoming HTTP request.
 * @param {import("express").Response} res - The outgoing HTTP response.
 * @param {import("express").NextFunction} next - Express next callback.
 * @returns {void}
 */
export default function unmatchedRouteMiddleware(req, res, next) {
  next(
    new AppError(
      HttpCode.NOT_FOUND,
      `Route not matched: ${req.method} ${req.originalUrl}`,
    ),
  );
}
