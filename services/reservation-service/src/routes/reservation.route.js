import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  createReservation,
  getReservationById,
  getReservationsByUser,
  cancelReservation,
} from "../controllers/reservation.controller.js";

const reservationRouter = Router();

// All reservation routes require authentication
reservationRouter.use(authMiddleware);

reservationRouter.post("/",              createReservation);
reservationRouter.get( "/user/:userId",  getReservationsByUser);
reservationRouter.get( "/:id",           getReservationById);
reservationRouter.post("/:id/cancel",    cancelReservation);

export default reservationRouter;
