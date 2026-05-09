import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";

export function toUserResponseDTO(user) {
  if (!user) return null;

  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    phoneNumber: user.phoneNumber ?? null,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toUserListDTO(users) {
  return users.map(toUserResponseDTO);
}

export function toUserIdDTO(id) {
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid userId");
  }

  return userId;
}
