import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRY, ADMIN_REGISTRATION_KEY } from "../config/env.js";
import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";
import AdminRepository from "../repositories/admin.repository.js";

const SALT_ROUNDS = 10;

/**
 * AdminService handles admin account management, including registration, login, and CRUD operations on admin records. It uses bcrypt for password hashing and JWT for authentication tokens. The service interacts with the AdminRepository for database operations and throws AppError instances for consistent error handling across the application.
 * Methods:
 * - register(data): Creates a new admin account after validating the registration key and ensuring the email is unique. Hashes the password before storing.
 * - login(email, password): Validates credentials and returns a signed JWT if successful.
 * - getById(adminId): Retrieves an admin record by ID.
 * - getAll(): Retrieves all admin records.
 * - update(data): Updates an existing admin record. If a new password is provided, it is hashed before updating.
 * - delete(adminId): Deletes an admin record by ID.
 * 
 * All methods throw AppError with appropriate HTTP status codes and messages for error scenarios, such as invalid input, authentication failures, or database issues.
 */
class AdminService {
  /**
   * Creates a new admin account.
   * Requires the correct ADMIN_REGISTRATION_KEY to prevent unauthorised creation.
   * @params {Object} data - The registration data, including firstName, lastName, email, password, and registrationKey.
   * @returns {Promise<Object>} The created admin record as a Mongoose document
   * @throws {AppError} If the registration key is invalid, if an admin with the email already exists, or if there is an issue creating the admin
   */
  static async register(data) {
    if (data.registrationKey !== ADMIN_REGISTRATION_KEY) {
      throw new AppError(HttpCode.FORBIDDEN, "Invalid registration key");
    }

    const existing = await AdminRepository.getByEmail(data.email);
    if (existing) {
      throw new AppError(HttpCode.BAD_REQUEST, "An admin with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
    const adminId = await AdminRepository.getNextId();

    return AdminRepository.create({
      adminId,
      firstName: data.firstName,
      lastName:  data.lastName,
      email:     data.email,
      password:  hashedPassword,
    });
  }

  /**
   * Authenticates an admin using their email and password. If successful, returns a JWT token along with basic admin info. The password is compared using bcrypt, and the token is signed with the JWT_SECRET. The token expiry is determined by JWT_EXPIRY.
   * @param {string} email - The admin's email address.
   * @param {string} password - The admin's plaintext password to be verified against the stored hash.
   * @returns {Promise<Object>} An object containing the JWT token and basic admin info (adminId, email, firstName, lastName).
   * @throws {AppError} If the email is not found or if the password is incorrect, an AppError with status UNAUTHORIZED is thrown. If there is an issue accessing the database, an AppError with status SERVER_ERROR is thrown.
   */
  static async login(email, password) {
    const admin = await AdminRepository.getByEmail(email);
    if (!admin) {
      throw new AppError(HttpCode.UNAUTHORIZED, "Invalid email or password");
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      throw new AppError(HttpCode.UNAUTHORIZED, "Invalid email or password");
    }

    const token = jwt.sign(
      {
        adminId: admin.adminId,
        email: admin.email,
        role: "admin",
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY || "24h" },
    );

    return { token, adminId: admin.adminId, email: admin.email, firstName: admin.firstName, lastName: admin.lastName };
  }

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
    if (!adminId) throw new AppError(HttpCode.BAD_REQUEST, "adminId is required");
    const result = await AdminRepository.delete(adminId);
    if (result.deletedCount === 0) throw new AppError(HttpCode.NOT_FOUND, "Admin not found");
    return result;
  }
}

export default AdminService;
