import AdminService from "../services/admin.service.js";
import {
  toAdminRegistrationRequestDTO,
  toAdminLoginRequestDTO,
  toAdminUpdateRequestDTO,
  toAdminResponseDTO,
  toAdminListDTO,
} from "../dto/admin.dto.js";

/**
 * Handles POST /admin/auth/register
 * Validates the request body and creates a new admin account.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with the created admin profile (201)
 */
export const register = async (req, res) => {
  const data = toAdminRegistrationRequestDTO(req.body);
  const admin = await AdminService.register(data);
  res.status(201).json(toAdminResponseDTO(admin));
};

/**
 * Handles POST /admin/auth/login
 * Validates credentials and returns a signed JWT on success.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with token and admin details
 */
export const login = async (req, res) => {
  const { email, password } = toAdminLoginRequestDTO(req.body);
  const result = await AdminService.login(email, password);
  res.json(result);
};

/**
 * Handles GET /admin/auth/profile
 * Returns the profile of the currently authenticated admin.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with the admin's public profile fields
 */
export const getProfile = async (req, res) => {
  const admin = await AdminService.getById(req.admin.adminId);
  res.json(toAdminResponseDTO(admin));
};

/**
 * Handles GET /admin/auth/all
 * Returns a list of all registered admin accounts.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON array of admin profiles
 */
export const getAllAdmins = async (req, res) => {
  const admins = await AdminService.getAll();
  res.json(toAdminListDTO(admins));
};

/**
 * Handles PUT /admin/auth/update/:id
 * Updates the profile fields of an existing admin.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with the updated admin profile
 */
export const updateAdmin = async (req, res) => {
  const data = toAdminUpdateRequestDTO(req.params.id, req.body);
  const updated = await AdminService.update(data);
  res.json(toAdminResponseDTO(updated));
};

/**
 * Handles DELETE /admin/auth/delete/:id
 * Permanently removes an admin account by numeric ID.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON with the deletion result
 */
export const deleteAdmin = async (req, res) => {
  const adminId = Number(req.params.id);
  const result = await AdminService.delete(adminId);
  res.json(result);
};
