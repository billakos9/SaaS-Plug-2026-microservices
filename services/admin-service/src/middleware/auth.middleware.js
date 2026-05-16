import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    return next(
      new AppError(HttpCode.UNAUTHORIZED, "Missing or malformed Authorization header"),
    );
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "admin") {
      return next(new AppError(HttpCode.FORBIDDEN, "Admin access only"));
    }

    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token expired"));
    }

    return next(new AppError(HttpCode.UNAUTHORIZED, "Invalid token"));
  }
}
