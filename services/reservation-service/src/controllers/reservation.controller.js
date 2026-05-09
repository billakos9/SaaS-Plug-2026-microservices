import ReservationService from "../services/reservation.service.js";
import {
  toReservationRequestDTO,
  toReservationResponseDTO,
  toReservationListDTO,
} from "../dto/reservation.dto.js";

/**
 * Handles POST /reservation/
 * Creates a new reservation for the authenticated user.
 *
 * @param {import("express").Request} req - Express request; body must contain chargerId, providerName, duration; req.user must contain userId (set by auth middleware)
 * @param {import("express").Response} res - Express response; returns 201 with the created reservation DTO
 * @returns {Promise<void>} Responds with the new reservation or delegates errors to the error middleware
 */
export const createReservation = async (req, res) => {
  const data = toReservationRequestDTO(req.user.userId, req.body);
  const reservation = await ReservationService.create(data);
  res.status(201).json(toReservationResponseDTO(reservation));
};

/**
 * Handles GET /reservation/:id
 * Returns a single reservation by its numeric id.
 *
 * @param {import("express").Request} req - Express request; params.id is the numeric reservation ID
 * @param {import("express").Response} res - Express response; returns 200 with the reservation DTO
 * @returns {Promise<void>} Responds with the reservation or delegates errors to the error middleware
 */
export const getReservationById = async (req, res) => {
  const reservationId = Number(req.params.id);
  const reservation = await ReservationService.getById(reservationId);
  res.json(toReservationResponseDTO(reservation));
};

/**
 * Handles GET /reservation/user/:userId
 * Returns all reservations belonging to a given user.
 *
 * @param {import("express").Request} req - Express request; params.userId is the numeric user ID
 * @param {import("express").Response} res - Express response; returns 200 with an array of reservation DTOs
 * @returns {Promise<void>} Responds with the reservation list or delegates errors to the error middleware
 */
export const getReservationsByUser = async (req, res) => {
  const userId = Number(req.params.userId);
  const reservations = await ReservationService.getByUserId(userId);
  res.json(toReservationListDTO(reservations));
};
