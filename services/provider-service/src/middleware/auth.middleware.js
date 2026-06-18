import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { revokedEmails } from "../lib/revoked-tokens.js";

export function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer "))
    return next(new AppError(HttpCode.UNAUTHORIZED, "Missing or malformed Authorization header"));
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (revokedEmails.has(decoded.email)) {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token revoked"));
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token expired"));
    return next(new AppError(HttpCode.UNAUTHORIZED, "Invalid token"));
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role)
      return next(new AppError(HttpCode.FORBIDDEN, `${role} access only`));
    next();
  };
}
