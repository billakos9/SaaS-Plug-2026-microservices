import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { revokedEmails } from "../lib/revoked-tokens.js";

export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed Authorization header" });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (revokedEmails.has(decoded.email)) {
      return res.status(401).json({ message: "Token revoked" });
    }
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}
