import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AppError from "../errors/app-error.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";
import { writeOutbox } from "../infrastructure/outbox.js";
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

    // Whitelist: only allow updating these profile fields
    const { name, firstName, lastName, birthdate, phoneNumber } = updateData;
    const allowedUpdate = {};
    if (name !== undefined) allowedUpdate.name = name;
    if (firstName !== undefined) allowedUpdate.firstName = firstName;
    if (lastName !== undefined) allowedUpdate.lastName = lastName;
    if (birthdate !== undefined) allowedUpdate.birthdate = birthdate;
    if (phoneNumber !== undefined) allowedUpdate.phoneNumber = phoneNumber;

    // Nothing updatable was sent — return existing profile unchanged
    if (Object.keys(allowedUpdate).length === 0) {
      return existing;
    }

    const updated = await UserRepository.update(userId, allowedUpdate);

    // Notify other services if name changed
    if (allowedUpdate.name) {
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

    const eventPayload = { userId: existing.userId, email: existing.email };

    // 1. Persist publish intent BEFORE deleting so the event is never lost
    const outboxEntry = await writeOutbox(Exchanges.USER, RoutingKeys.USER_DELETED, eventPayload);

    // 2. Delete from DB
    const result = await UserRepository.delete(userId);

    // 3. Try to publish immediately; outbox relay retries if this fails
    try {
      await publishEvent(Exchanges.USER, RoutingKeys.USER_DELETED, eventPayload);
    } catch (err) {
      console.warn("[user-service] outbox: immediate publish failed, relay will retry:", err.message);
      return result; // stop here — don't try to save, let relay handle it
    }

    // publish succeeded — mark as processed (best-effort)
    try {
      outboxEntry.publishedAt = new Date();
      await outboxEntry.save();
    } catch (saveErr) {
      // relay will find this entry and republish — downstream consumers must be idempotent
      console.error("[user-service] outbox: failed to mark entry as published:", saveErr.message);
    }

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
