import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Catch-all middleware that forwards a 404 AppError for any route not matched by the router.
 *
 * @param {import("express").Request} req - Express request; method and originalUrl are used in the error message
 * @param {import("express").Response} res - Express response (unused; error is delegated)
 * @param {import("express").NextFunction} next - Receives the 404 AppError to be handled by the error middleware
 */
export default function unmatchedRouteMiddleware(req, res, next) {
  next(new AppError(HttpCode.NOT_FOUND, `Route not matched: ${req.method} ${req.originalUrl}`));
}
