import { Router } from "express";
import ReservationRepository from "../repositories/reservation.repository.js";

const internalRouter = Router();

// Called only by analytics-service inside the Docker network — no public gateway exposure.
internalRouter.get("/by-provider", async (req, res, next) => {
  try {
    const { providerName, period } = req.query;
    if (!providerName || !period) {
      return res.status(400).json({ error: "providerName and period are required" });
    }
    const reservations = await ReservationRepository.getCompletedByProviderAndPeriod(providerName, period);
    res.json(reservations);
  } catch (err) {
    next(err);
  }
});

export default internalRouter;
