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
}

export default UserService;
