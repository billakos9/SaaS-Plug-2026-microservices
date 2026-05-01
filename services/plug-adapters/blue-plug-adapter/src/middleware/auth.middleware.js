import jwt from "jsonwebtoken";
import { AppError } from "../errors/app_error.js";
import { HttpCode } from "../constants/http_codes.js";
import { JWT_SECRET } from "../config/env.js";


/**
 * Verifies the JWT token from the request headers.
 * @param {Object} req - The Express request object.
 * @returns {Object} The decoded token payload if valid.
 * @throws {AppError} If the token is missing, invalid, or expired.
 */
function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(HttpCode.BAD_REQUEST, "Access denied. No token provided");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new AppError(HttpCode.BAD_REQUEST, "Access denied. Invalid token format.");
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid or expired token.");
  }
}

/**
 * Middleware to protect routes by verifying JWT tokens.
 * Attaches the decoded token payload to req.user if valid.
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
 * Allows access only if the decoded token has an admin role.
 */
export function authorize(req, res, next) {
  try {  const decoded = verifyToken(req);
    req.user = decoded;

    if (decoded.role !== "admin") {
      throw new AppError(HttpCode.BAD_REQUEST, "Access denied. Admins only.");
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function authorizeDummy(req, res, next) {
  // Dummy middleware that allows all requests
  next();
}
