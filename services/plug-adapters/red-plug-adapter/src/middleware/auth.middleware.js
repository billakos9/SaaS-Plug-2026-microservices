import jwt from "jsonwebtoken";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { JWT_SECRET } from "../config/env.js";

/**
 * Verifies the JWT token from the request headers.
 * @param {import("express").Request} req
 * @returns {Object} Decoded token payload
 * @throws {AppError} If token is missing, invalid, or expired.
 */
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(
      HttpCode.BAD_REQUEST,
      "Access denied. No token provided",
    );
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new AppError(
      HttpCode.BAD_REQUEST,
      "Access denied. Invalid token format.",
    );
  }

  if (!JWT_SECRET) {
    throw new AppError(HttpCode.SERVER_ERROR, "JWT secret is not configured.");
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid or expired token.");
  }
}

/**
 * Middleware that verifies JWT and sets req.user.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function protect(req, res, next) {
  try {
    const decoded = verifyToken(req);
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to authorize admin users.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function authorize(req, res, next) {
  try {
    const decoded = verifyToken(req);
    req.user = decoded;

    if (decoded.role !== "admin") {
      throw new AppError(HttpCode.BAD_REQUEST, "Access denied. Admins only.");
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Dummy authorization middleware that allows all requests.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function authorizeDummy(req, res, next) {
  next();
}
