import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { revokedEmails } from "../lib/revoked-tokens.js";

export function requireProviderAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError(HttpCode.UNAUTHORIZED, "Missing or malformed Authorization header"));
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (revokedEmails.has(decoded.email)) {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token revoked"));
    }
    if (decoded.role !== "provider" && decoded.role !== "admin") {
      return next(new AppError(HttpCode.FORBIDDEN, "Provider or Admin access only"));
    }
    req.user = decoded;
    if (decoded.role === "provider") req.provider = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token expired"));
    }
    return next(new AppError(HttpCode.UNAUTHORIZED, "Invalid token"));
  }
}
