import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

export function requireProviderAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError(HttpCode.UNAUTHORIZED, "Missing or malformed Authorization header"));
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "provider") {
      return next(new AppError(HttpCode.FORBIDDEN, "Provider access only"));
    }
    req.provider = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token expired"));
    }
    return next(new AppError(HttpCode.UNAUTHORIZED, "Invalid token"));
  }
}

export function requireSelfProvider(req, res, next) {
  if (req.provider.providerName !== req.params.providerName) {
    return next(new AppError(HttpCode.FORBIDDEN, "Access denied: token does not match requested provider"));
  }
  next();
}
