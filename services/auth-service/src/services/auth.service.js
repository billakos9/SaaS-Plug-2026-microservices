import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";
import AuthUserRepository from "../repositories/auth-user.repository.js";

class AuthService {
    /**
     * Verifies email/pass and returns a signed JWT
     */

    static async login(email, password) {
        // Need email & password
        if (!email || !password) {
            throw new AppError(HttpCode.BAD_REQUEST, "Email & Password are required");
        }

        // find user
        const user = await AuthUserRepository.findByEmail(email);
        if (!user) {
            throw new AppError(HttpCode.BAD_REQUEST, "Invalid Credentials");
        }

        // Compare with stored hash
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new AppError(HttpCode.BAD_REQUEST, "Invalid Credentials");
        }

        // Sign JWT
        const payload = {
            userId: user.userId,
            role: user.role
        };
        // 2 hours in seconds
        const expiresIn = 2 * 60 * 60;

        const accessToken = jwt.sign(
            payload,
            JWT_SECRET,
            {expiresIn: `${expiresIn}s`,}
        );

        return {
            accessToken, 
            expiresIn,
            role: user.role    
        };
    }

    static validateToken(token) {
        if (!token) {
            throw new AppError(
                HttpCode.BAD_REQUEST, "Token is required"
            );
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return {
                valid: true,
                userId: decoded.userId,
                role: decoded.role,
            };
        } catch(err) {
            throw new AppError(
                HttpCode.BAD_REQUEST, "Invalid or Expired token"
            );
        }
    }
}

export default AuthService

