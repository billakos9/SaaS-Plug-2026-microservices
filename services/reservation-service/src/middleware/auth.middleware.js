import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { revokedEmails } from "../lib/revoked-tokens.js";

/**
 * Verifies the Bearer JWT from the Authorization header and attaches the decoded payload to req.user.
 *
 * Expects the token to contain at least { userId }. Delegates an AppError to the next
 * middleware if the header is absent, malformed, expired, or otherwise invalid.
 *
 * @param {import("express").Request} req - Express request; must include an Authorization: Bearer <token> header
 * @param {import("express").Response} res - Express response (unused; error handling is delegated)
 * @param {import("express").NextFunction} next - Calls next() on success or next(AppError) on failure
 */
export default function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError(HttpCode.UNAUTHORIZED, "Missing or malformed Authorization header"));
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (revokedEmails.has(decoded.email)) {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token revoked"));
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token expired"));
    }
    return next(new AppError(HttpCode.UNAUTHORIZED, "Invalid token"));
  }
}
