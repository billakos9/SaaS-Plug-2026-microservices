import ReservationService from "../services/reservation.service.js";
import {
  toReservationRequestDTO,
  toReservationResponseDTO,
  toReservationListDTO,
} from "../dto/reservation.dto.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

const assertOwnReservation = (reservation, userId) => {
  if (Number(reservation.userId) !== Number(userId)) {
    throw new AppError(HttpCode.FORBIDDEN, "Access denied");
  }
};

export const createReservation = async (req, res) => {
  const data = toReservationRequestDTO(req.user.userId, req.body);
  const reservation = await ReservationService.create(data);

  res.status(201).json(toReservationResponseDTO(reservation));
};

export const getReservationById = async (req, res) => {
  const reservationId = Number(req.params.id);

  if (!Number.isFinite(reservationId)) {
    throw new AppError(HttpCode.BAD_REQUEST, "reservationId must be a valid number");
  }

  const reservation = await ReservationService.getById(reservationId);
  assertOwnReservation(reservation, req.user.userId);

  res.json(toReservationResponseDTO(reservation));
};

export const getReservationsByUser = async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isFinite(userId)) {
    throw new AppError(HttpCode.BAD_REQUEST, "userId must be a valid number");
  }

  if (userId !== Number(req.user.userId)) {
    throw new AppError(HttpCode.FORBIDDEN, "Access denied");
  }

  const reservations = await ReservationService.getByUserId(userId);
  res.json(toReservationListDTO(reservations));
};

export const cancelReservation = async (req, res) => {
  const reservationId = Number(req.params.id);

  if (!Number.isFinite(reservationId)) {
    throw new AppError(HttpCode.BAD_REQUEST, "reservationId must be a valid number");
  }

  const reservation = await ReservationService.getById(reservationId);
  assertOwnReservation(reservation, req.user.userId);

  const updated = await ReservationService.cancel(reservationId);
  res.json(toReservationResponseDTO(updated));
};
