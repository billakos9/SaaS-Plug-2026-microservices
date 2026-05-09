import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AppError from "../errors/app-error.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";
import ReservationRepository from "../repositories/reservation.repository.js";

/**
 * Business-logic layer for reservation operations.
 *
 * Coordinates between the repository (persistence) and the RabbitMQ broker (events).
 * All methods are static — no instance needs to be created.
 */
class ReservationService {
  /**
   * Creates a reservation, persists it, and publishes a reservation.created event.
   *
   * The event payload satisfies two consumers:
   *  - charger-service: needs { id, status } to update charger availability
   *  - plug-service:    needs { pointId, providerName, duration } to call the adapter
   *
   * @param {{ userId: number, chargerId: number, providerName: string, duration: number }} data - Validated reservation request DTO
   * @returns {Promise<Object>} The newly created Mongoose reservation document
   * @throws {AppError} If the repository or broker call fails unexpectedly
   */
  static async create(data) {
    const reservationId = await ReservationRepository.getNextId();

    const reservation = await ReservationRepository.create({
      reservationId,
      userId:       data.userId,
      chargerId:    data.chargerId,
      providerName: data.providerName,
      duration:     data.duration,
      status:       "active",
    });

    await publishEvent(Exchanges.RESERVATION, RoutingKeys.RESERVATION_CREATED, {
      reservationId:    reservation.reservationId,
      userId:           reservation.userId,
      id:               reservation.chargerId,   // charger-service key
      pointId:          reservation.chargerId,   // plug-service key
      providerName:     reservation.providerName,
      duration:         reservation.duration,
      status:           "reserved",
    });

    return reservation;
  }

  /**
   * Returns a single reservation by its numeric ID.
   *
   * @param {number} reservationId - The unique numeric reservation identifier
   * @returns {Promise<Object>} The lean reservation document
   * @throws {AppError} 404 if no reservation with the given ID exists
   */
  static async getById(reservationId) {
    const reservation = await ReservationRepository.getById(reservationId);
    if (!reservation) throw new AppError(HttpCode.NOT_FOUND, "Reservation not found");
    return reservation;
  }

  /**
   * Returns all reservations belonging to a given user.
   *
   * @param {number} userId - The numeric user identifier
   * @returns {Promise<Object[]>} Array of lean reservation documents (may be empty)
   */
  static async getByUserId(userId) {
    return ReservationRepository.getByUserId(userId);
  }
}

export default ReservationService;
