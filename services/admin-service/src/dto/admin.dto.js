import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Validates and transforms raw request body into an admin registration payload.
 *
 * @param {Object} input - Raw request body
 * @param {string} input.firstName - Admin's first name
 * @param {string} input.lastName - Admin's last name
 * @param {string} input.email - Admin's email address
 * @param {string} input.password - Plain-text password
 * @param {string} input.registrationKey - Secret key required for registration
 * @returns {{ firstName: string, lastName: string, email: string, password: string, registrationKey: string }} Sanitised registration data
 * @throws {AppError} If any required field is missing or blank
 */
export function toAdminRegistrationRequestDTO(input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Request body is required");

  if (!input.firstName?.trim())       throw new AppError(HttpCode.BAD_REQUEST, "firstName is required");
  if (!input.lastName?.trim())        throw new AppError(HttpCode.BAD_REQUEST, "lastName is required");
  if (!input.email?.trim())           throw new AppError(HttpCode.BAD_REQUEST, "email is required");
  if (!input.password?.trim())        throw new AppError(HttpCode.BAD_REQUEST, "password is required");
  if (!input.registrationKey?.trim()) throw new AppError(HttpCode.BAD_REQUEST, "registrationKey is required");

  return {
    firstName:       input.firstName.trim(),
    lastName:        input.lastName.trim(),
    email:           input.email.trim().toLowerCase(),
    password:        input.password.trim(),
    registrationKey: input.registrationKey.trim(),
  };
}

/**
 * Validates and transforms raw request body into an admin login payload.
 *
 * @param {Object} input - Raw request body
 * @param {string} input.email - Admin's email address
 * @param {string} input.password - Plain-text password
 * @returns {{ email: string, password: string }} Sanitised login credentials
 * @throws {AppError} If email or password is missing
 */
export function toAdminLoginRequestDTO(input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Request body is required");
  if (!input.email?.trim())    throw new AppError(HttpCode.BAD_REQUEST, "email is required");
  if (!input.password?.trim()) throw new AppError(HttpCode.BAD_REQUEST, "password is required");

  return {
    email:    input.email.trim().toLowerCase(),
    password: input.password.trim(),
  };
}

/**
 * Validates and transforms route params and request body into an admin update payload.
 * Only fields present in the body are included in the returned object.
 *
 * @param {string|number} id - Admin ID from the route parameter
 * @param {Object} input - Raw request body with optional update fields
 * @param {string} [input.firstName]
 * @param {string} [input.lastName]
 * @param {string} [input.email]
 * @param {string} [input.password]
 * @returns {{ adminId: number, firstName?: string, lastName?: string, email?: string, password?: string }} Partial update payload
 * @throws {AppError} If the body is missing or the id is not a valid number
 */
export function toAdminUpdateRequestDTO(id, input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Request body is required");

  const adminId = Number(id);
  if (Number.isNaN(adminId)) throw new AppError(HttpCode.BAD_REQUEST, "Invalid adminId");

  const dto = { adminId };
  if (input.firstName !== undefined) dto.firstName = String(input.firstName).trim();
  if (input.lastName  !== undefined) dto.lastName  = String(input.lastName).trim();
  if (input.email     !== undefined) dto.email     = String(input.email).trim().toLowerCase();
  if (input.password  !== undefined) dto.password  = String(input.password).trim();

  return dto;
}

/**
 * Transforms an admin document into a safe public-facing response object,
 * omitting sensitive fields such as the hashed password.
 *
 * @param {Object} admin - Admin document from the database
 * @returns {{ adminId: number, firstName: string, lastName: string, email: string, createdAt: Date }} Public admin profile
 */
export function toAdminResponseDTO(admin) {
  return {
    adminId:   admin.adminId,
    firstName: admin.firstName,
    lastName:  admin.lastName,
    email:     admin.email,
    createdAt: admin.createdAt,
  };
}

/**
 * Maps an array of admin documents to public response DTOs.
 *
 * @param {Object[]} admins - Array of admin documents from the database
 * @returns {Array<{ adminId: number, firstName: string, lastName: string, email: string, createdAt: Date }>} Array of public admin profiles
 */
export function toAdminListDTO(admins) {
  return admins.map(toAdminResponseDTO);
}
