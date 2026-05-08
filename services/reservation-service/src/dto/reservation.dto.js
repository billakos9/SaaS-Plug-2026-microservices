import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

/**
 * Validates and maps raw request data into a reservation creation payload.
 *
 * @param {number} userId - The authenticated user's ID (taken from the JWT payload)
 * @param {Object} input - Raw request body from the client
 * @param {number|string} input.chargerId - ID of the charger to reserve (must be a valid number)
 * @param {string} input.providerName - Name of the charging provider (must be non-empty)
 * @param {number} [input.duration=60] - Reservation duration in minutes (must be >= 1)
 * @returns {{ userId: number, chargerId: number, providerName: string, duration: number }} Validated request DTO
 * @throws {AppError} If input is missing, chargerId is invalid, providerName is blank, or duration is non-positive
 */
export function toReservationRequestDTO(userId, input) {
  if (!input) throw new AppError(HttpCode.BAD_REQUEST, "Request body is required");

  const chargerId = Number(input.chargerId);
  if (!input.chargerId || Number.isNaN(chargerId)) {
    throw new AppError(HttpCode.BAD_REQUEST, "chargerId must be a valid number");
  }

  if (!input.providerName?.trim()) {
    throw new AppError(HttpCode.BAD_REQUEST, "providerName is required");
  }

  const duration = input.duration !== undefined ? Number(input.duration) : 60;
  if (Number.isNaN(duration) || duration < 1) {
    throw new AppError(HttpCode.BAD_REQUEST, "duration must be a positive number of minutes");
  }

  return {
    userId,
    chargerId,
    providerName: input.providerName.trim(),
    duration,
  };
}

/**
 * Maps a Mongoose reservation document to the public-facing response shape.
 *
 * @param {Object} data - A Mongoose reservation document or lean object
 * @returns {{ reservationId: number, userId: number, chargerId: number, providerName: string, duration: number, status: string, createdAt: Date, updatedAt: Date }} Reservation response DTO
 */
export function toReservationResponseDTO(data) {
  return {
    reservationId: data.reservationId,
    userId:        data.userId,
    chargerId:     data.chargerId,
    providerName:  data.providerName,
    duration:      data.duration,
    status:        data.status,
    createdAt:     data.createdAt,
    updatedAt:     data.updatedAt,
  };
}

/**
 * Maps an array of Mongoose reservation documents to an array of response DTOs.
 *
 * @param {Object[]} reservations - Array of Mongoose reservation documents or lean objects
 * @returns {{ reservationId: number, userId: number, chargerId: number, providerName: string, duration: number, status: string, createdAt: Date, updatedAt: Date }[]} Array of reservation response DTOs
 */
export function toReservationListDTO(reservations) {
  return reservations.map(toReservationResponseDTO);
}
