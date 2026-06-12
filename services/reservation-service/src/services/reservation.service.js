import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import { CHARGER_SERVICE_URL } from "../config/env.js";
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
    let kwhPrice = 0;
    let locationName = data.locationName || `Station ${data.chargerId}`;
    try {
      const res = await fetch(`${CHARGER_SERVICE_URL}/charger/id/${data.chargerId}`);
      if (res.ok) {
        const charger = await res.json();
        kwhPrice = charger.kwhPrice ?? 0;
        if (!data.locationName) {
          locationName = charger.locationName || locationName;
        }
      }
    } catch {
      // non-fatal — reservation proceeds with default values
    }

    const reservationId = await ReservationRepository.getNextId();

    const reservation = await ReservationRepository.create({
      reservationId,
      userId:       data.userId,
      chargerId:    data.chargerId,
      locationName,
      capacityKw:   data.capacityKw || 22,
      providerName: data.providerName,
      duration:     data.duration,
      kwhPrice,
      status:       "active",
    });

    await publishEvent(Exchanges.RESERVATION, RoutingKeys.RESERVATION_CREATED, {
      reservationId:    reservation.reservationId,
      userId:           reservation.userId,
      id:               reservation.chargerId,   // charger-service key
      pointId:          reservation.chargerId,   // plug-service key
      locationName:     reservation.locationName,
      capacityKw:       reservation.capacityKw,
      providerName:     reservation.providerName,
      duration:         reservation.duration,
      kwhPrice:         reservation.kwhPrice,
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

  /**
   * Cancels a reservation by its ID.
   *
   * @param {number} reservationId - The unique numeric reservation identifier
   * @returns {Promise<Object>} The updated reservation document
   * @throws {AppError} 404 if no reservation exists
   */
  static async cancel(reservationId) {
    const reservation = await ReservationRepository.getById(reservationId);
    if (!reservation) throw new AppError(HttpCode.NOT_FOUND, "Reservation not found");

    const actualDuration = Math.round((new Date() - new Date(reservation.createdAt)) / 1000);
    const totalCost = (actualDuration / 3600) * (reservation.capacityKw || 22) * reservation.kwhPrice;

    await ReservationRepository.update(reservationId, { 
      status: "cancelled", 
      duration: actualDuration 
    });

    await publishEvent(Exchanges.RESERVATION, RoutingKeys.RESERVATION_CANCELLED, {
      reservationId: reservation.reservationId,
      id:            reservation.chargerId,
      status:        "available",
      actualDuration,
      totalCost,
      capacityKw:    reservation.capacityKw,
      providerName:  reservation.providerName,
    });

    return reservation;
  }

  /**
   * Completes a reservation by its ID.
   *
   * @param {number} reservationId - The unique numeric reservation identifier
   * @returns {Promise<Object>} The updated reservation document
   * @throws {AppError} 404 if no reservation exists
   */
  static async complete(reservationId) {
    const reservation = await ReservationRepository.getById(reservationId);
    if (!reservation) throw new AppError(HttpCode.NOT_FOUND, "Reservation not found");

    const actualDuration = Math.round((new Date() - new Date(reservation.createdAt)) / 1000);
    const totalCost = (actualDuration / 3600) * (reservation.capacityKw || 22) * reservation.kwhPrice;

    await ReservationRepository.update(reservationId, { 
      status: "completed", 
      duration: actualDuration 
    });

    await publishEvent(Exchanges.RESERVATION, RoutingKeys.RESERVATION_COMPLETED, {
      reservationId: reservation.reservationId,
      id:            reservation.chargerId,
      status:        "available",
      actualDuration,
      totalCost,
      capacityKw:    reservation.capacityKw,
      providerName:  reservation.providerName,
    });

    return reservation;
  }
}

export default ReservationService;
