import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";
import UserRepository from "../repositories/user.repository.js";

class UserService {
  static async getAllUsers() {
    return UserRepository.getAll();
  }

  static async getUserById(userId) {
    const user = await UserRepository.getById(userId);

    if (!user) {
      throw new AppError(HttpCode.NOT_FOUND, "User not found");
    }

    return user;
  }

  static async getCurrentUser(userId) {
    const user = await UserRepository.getById(userId);

    if (!user) {
      throw new AppError(HttpCode.NOT_FOUND, "User profile not found");
    }

    return user;
  }

  static async deleteUser(userId) {
    const existing = await UserRepository.getById(userId);

    if (!existing) {
      throw new AppError(HttpCode.NOT_FOUND, "User not found");
    }

    return UserRepository.delete(userId);
  }

  static async syncCreatedUser(userData) {
    const userId = Number(userData.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(HttpCode.BAD_REQUEST, "Invalid userId in user.created event");
    }

    if (!userData.email || !userData.name) {
      throw new AppError(HttpCode.BAD_REQUEST, "Invalid user.created event payload");
    }

    const user = await UserRepository.upsert({
      userId,
      email: userData.email,
      name: userData.name,
      phoneNumber: userData.phoneNumber ?? null,
      role: userData.role ?? "user",
    });

    await UserRepository.setCounterAtLeast(userId);

    return user;
  }

}

export default UserService;
