import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  createReservation,
  cancelReservation,
  getReservationById,
  getReservationsByUser,
} from "../controllers/reservation.controller.js";

const reservationRouter = Router();

// All reservation routes require authentication
reservationRouter.use(authMiddleware);

reservationRouter.post(  "/",              createReservation);
reservationRouter.delete("/cancel/:id",    cancelReservation);
reservationRouter.get(   "/user/:userId",  getReservationsByUser);
reservationRouter.get(   "/:id",           getReservationById);

export default reservationRouter;
