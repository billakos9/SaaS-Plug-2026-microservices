import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AppError from "../errors/app-error.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";
import AuthUserRepository from "../repositories/auth-user.repository.js";

class AuthService {
  static async register({ email, password, name, phoneNumber }) {
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof name !== "string" ||
      email.trim() === "" ||
      password.trim() === "" ||
      name.trim() === ""
    ) {
      throw new AppError(
        HttpCode.BAD_REQUEST,
        "Email, password and name are required",
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedName = name.trim();
    const normalizedPhoneNumber =
      typeof phoneNumber === "string" && phoneNumber.trim() !== ""
        ? phoneNumber.trim()
        : null;

    const existingUser = await AuthUserRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError(HttpCode.CONFLICT, "Email already exists");
    }

    const userId = await AuthUserRepository.getNextId();
    const passwordHash = await bcrypt.hash(password, 10);
    const role = "user";

    const authUser = await AuthUserRepository.create({
      userId,
      email: normalizedEmail,
      passwordHash,
      role,
    });

    await publishEvent(Exchanges.USER, RoutingKeys.USER_CREATED, {
      userId: authUser.userId,
      email: authUser.email,
      name: normalizedName,
      phoneNumber: normalizedPhoneNumber,
      role: authUser.role,
    });

    return {
      userId: authUser.userId,
      email: authUser.email,
      role: authUser.role,
    };
  }

  static async login(email, password) {
    if (!email || !password) {
      throw new AppError(HttpCode.BAD_REQUEST, "Email & Password are required");
    }

    const user = await AuthUserRepository.findByEmail(email);
    if (!user) {
      throw new AppError(HttpCode.BAD_REQUEST, "Invalid Credentials");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(HttpCode.BAD_REQUEST, "Invalid Credentials");
    }

    const payload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
      ...(user.providerName ? { providerName: user.providerName } : {}),
    };

    const expiresIn = 2 * 60 * 60;

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${expiresIn}s`,
    });

    return {
      accessToken,
      expiresIn,
      role: user.role,
    };
  }

  static validateToken(token) {
    if (!token) {
      throw new AppError(HttpCode.BAD_REQUEST, "Token is required");
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      return {
        valid: true,
        userId: decoded.userId,
        role: decoded.role,
      };
    } catch {
      throw new AppError(HttpCode.BAD_REQUEST, "Invalid or Expired token");
    }
  }
}

export default AuthService;
