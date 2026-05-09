import UserService from "../services/user.service.js";
import {
  toUserIdDTO,
  toUserListDTO,
  toUserResponseDTO,
} from "../dto/user.dto.js";

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await UserService.getAllUsers();
    res.json(toUserListDTO(users));
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await UserService.getCurrentUser(req.user.userId);
    res.json(toUserResponseDTO(user));
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const userId = toUserIdDTO(req.params.id);
    const user = await UserService.getUserById(userId);
    res.json(toUserResponseDTO(user));
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const userId = toUserIdDTO(req.params.id);
    const result = await UserService.deleteUser(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
