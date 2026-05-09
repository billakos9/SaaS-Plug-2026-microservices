import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

export default function unmatchedRouteMiddleware(req, res, next) {
  next(
    new AppError(
      HttpCode.NOT_FOUND,
      `Route not matched: ${req.method} ${req.originalUrl}`,
    ),
  );
}
