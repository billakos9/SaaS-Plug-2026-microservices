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

export const createReservation = async (req, res, next) => {
  try {
    const data = toReservationRequestDTO(req.user.userId, req.body);
    const reservation = await ReservationService.create(data);
    res.status(201).json(toReservationResponseDTO(reservation));
  } catch (err) { next(err); }
};

export const getReservationById = async (req, res, next) => {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return next(new AppError(HttpCode.BAD_REQUEST, "reservationId must be a valid number"));
    }
    const reservation = await ReservationService.getById(reservationId);
    assertOwnReservation(reservation, req.user.userId);
    res.json(toReservationResponseDTO(reservation));
  } catch (err) { next(err); }
};

export const getReservationsByUser = async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return next(new AppError(HttpCode.BAD_REQUEST, "userId must be a valid number"));
    }
    if (userId !== Number(req.user.userId)) {
      return next(new AppError(HttpCode.FORBIDDEN, "Access denied"));
    }
    const reservations = await ReservationService.getByUserId(userId);
    res.json(toReservationListDTO(reservations));
  } catch (err) { next(err); }
};

export const cancelReservation = async (req, res, next) => {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return next(new AppError(HttpCode.BAD_REQUEST, "reservationId must be a valid number"));
    }
    const reservation = await ReservationService.getById(reservationId);
    assertOwnReservation(reservation, req.user.userId);
    const updated = await ReservationService.cancel(reservationId);
    res.json(toReservationResponseDTO(updated));
  } catch (err) { next(err); }
};

export const completeReservation = async (req, res, next) => {
  try {
    const reservationId = Number(req.params.id);
    if (!Number.isFinite(reservationId)) {
      return next(new AppError(HttpCode.BAD_REQUEST, "reservationId must be a valid number"));
    }
    const reservation = await ReservationService.getById(reservationId);
    assertOwnReservation(reservation, req.user.userId);

    if (reservation.status === "active") {
      const expiresAt = new Date(reservation.createdAt).getTime() + reservation.duration * 60000;
      // 30-second grace window to handle client-side timer jitter
      if (Date.now() < expiresAt - 30000) {
        return next(new AppError(HttpCode.BAD_REQUEST, "Session has not yet expired"));
      }
    }

    const updated = await ReservationService.complete(reservationId);
    res.json(toReservationResponseDTO(updated));
  } catch (err) { next(err); }
};
