import bcrypt from "bcryptjs";
import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AppError from "../errors/app-error.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";
import AdminRepository from "../repositories/admin.repository.js";

const SALT_ROUNDS = 10;

class AdminService {
  /**
   * Retrieves an admin record by their ID. If the admin is not found, an AppError with status NOT_FOUND is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   * @param {number} adminId - The unique identifier of the admin to retrieve.
   * @returns {Promise<Object>} The admin record as a plain JavaScript object.
   * @throws {AppError} If the admin is not found, an AppError with status NOT_FOUND is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   */
  static async getById(adminId) {
    const admin = await AdminRepository.getById(adminId);
    if (!admin) throw new AppError(HttpCode.NOT_FOUND, "Admin not found");
    return admin;
  }

  static async getByEmail(email) {
    const admin = await AdminRepository.getByEmail(email);
    if (!admin) throw new AppError(HttpCode.NOT_FOUND, "Admin not found");
    return admin;
  }

  /**
   * Retrieves all admin records. If there are no admins, an empty array is returned. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   * @returns {Promise<Array>} An array of all admin records as plain JavaScript objects.
   * @throws {AppError} If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   */
  static async getAll() {
    return AdminRepository.getAll();
  }

  /**
   * Updates an admin record by their ID. If the admin is not found, an AppError with status NOT_FOUND is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   * @param {Object} data - The data to update the admin with.
   * @returns {Promise<Object>} The updated admin record as a plain JavaScript object.
   * @throws {AppError} If the admin is not found, an AppError with status NOT_FOUND is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   */
  static async update(data) {
    if (!data.adminId) throw new AppError(HttpCode.BAD_REQUEST, "adminId is required");

    if (data.password) {
      data.password = await bcrypt.hash(data.password, SALT_ROUNDS);
    }

    const updated = await AdminRepository.update(data);
    if (!updated) throw new AppError(HttpCode.NOT_FOUND, "Admin not found");
    return updated;
  }

  /**
   * Deletes an admin record by their ID. If the admin is not found, an AppError with status NOT_FOUND is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   * @param {number} adminId - The unique identifier of the admin to delete.
   * @returns {Promise<Object>} The result of the deletion operation.
   * @throws {AppError} If the admin is not found, an AppError with status NOT_FOUND is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   */
  static async delete(adminId) {
    const normalizedAdminId = Number(adminId);
    if (!Number.isInteger(normalizedAdminId) || normalizedAdminId <= 0) {
      throw new AppError(HttpCode.BAD_REQUEST, "adminId is required");
    }

    const admin = await AdminRepository.getById(normalizedAdminId);
    if (!admin) throw new AppError(HttpCode.NOT_FOUND, "Admin not found");

    const result = await AdminRepository.delete(normalizedAdminId);
    if (result.deletedCount === 0) throw new AppError(HttpCode.NOT_FOUND, "Admin not found");

    await publishEvent(Exchanges.ADMIN, RoutingKeys.ADMIN_DELETED, {
      adminId: admin.adminId,
      email: admin.email,
    });

    return result;
  }
}

export default AdminService;
