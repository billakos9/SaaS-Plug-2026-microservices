import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Catch-all middleware that forwards a 404 AppError for any request that did
 * not match a registered route.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export default function unmatchedRouteMiddleware(req, res, next) {
  next(new AppError(HttpCode.NOT_FOUND, `Route not matched: ${req.method} ${req.originalUrl}`));
}
