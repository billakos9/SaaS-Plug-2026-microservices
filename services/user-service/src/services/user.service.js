import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AppError from "../errors/app-error.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";
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

  static async updateUser(userId, updateData) {
    const existing = await UserRepository.getById(userId);
    if (!existing) {
      throw new AppError(HttpCode.NOT_FOUND, "User not found");
    }

    // Don't allow updating sensitive fields directly here if needed
    delete updateData.userId;
    delete updateData.role;

    const updated = await UserRepository.update({
      userId,
      ...updateData
    });

    // Notify other services if critical fields changed
    if (updateData.email || updateData.name) {
      await publishEvent(Exchanges.USER, RoutingKeys.USER_UPDATED, {
        userId,
        email: updated.email,
        name: updated.name,
      });
    }

    return updated;
  }

  static async deleteUser(userId) {
    const existing = await UserRepository.getById(userId);

    if (!existing) {
      throw new AppError(HttpCode.NOT_FOUND, "User not found");
    }

    const result = await UserRepository.delete(userId);

    await publishEvent(Exchanges.USER, RoutingKeys.USER_DELETED, {
      userId: existing.userId,
      email: existing.email,
    });

    return result;
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
      ...(userData.username != null ? { username: userData.username } : {}),
      name: userData.name,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      birthdate: userData.birthdate ?? null,
      phoneNumber: userData.phoneNumber ?? null,
      role: userData.role ?? "user",
    });

    await UserRepository.setCounterAtLeast(userId);

    return user;
  }

}

export default UserService;
