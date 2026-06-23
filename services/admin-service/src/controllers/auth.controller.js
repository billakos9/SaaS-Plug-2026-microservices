import AdminService from "../services/admin.service.js";
import {
  toAdminUpdateRequestDTO,
  toAdminResponseDTO,
  toAdminListDTO,
} from "../dto/admin.dto.js";

/**
 * Handles GET /admin/profile
 * Returns the profile of the currently authenticated admin.
 * Looks up by email (always in JWT) to support both old adminId tokens and new userId tokens.
 */
export const getProfile = async (req, res, next) => {
  try {
    const admin = await AdminService.getByEmail(req.admin.email);
    res.json(toAdminResponseDTO(admin));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /admin/accounts
 * Returns a list of all registered admin accounts.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of admin profiles
 */
export const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await AdminService.getAll();
    res.json(toAdminListDTO(admins));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles PUT /admin/accounts/:id
 * Updates the profile fields of an existing admin.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with the updated admin profile
 */
export const updateAdmin = async (req, res, next) => {
  try {
    const data = toAdminUpdateRequestDTO(req.params.id, req.body);
    const updated = await AdminService.update(data);
    res.json(toAdminResponseDTO(updated));
  } catch (err) {
    next(err);
  }
};

/**
 * Handles DELETE /admin/accounts/:id
 * Permanently removes an admin account by numeric ID.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with the deletion result
 */
export const deleteAdmin = async (req, res, next) => {
  try {
    const adminId = Number(req.params.id);
    const result = await AdminService.delete(adminId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
