// for user/me request

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError(HttpCode.UNAUTHORIZED, "Missing or malformed Authorization header"),
    );
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new AppError(HttpCode.UNAUTHORIZED, "Token expired"));
    }

    return next(new AppError(HttpCode.UNAUTHORIZED, "Invalid token"));
  }
}
