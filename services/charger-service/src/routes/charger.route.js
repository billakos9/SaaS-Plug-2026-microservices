import { Router } from "express";

import {
  getChargerPointById,
  getChargerPointByLocation,
  addChargerPoint,
  getAllChargerPoints,
  getAllChargerPointsByStatus,
} from "../controllers/charger-point.controller.js";
import { authMiddleware, requireRole } from "../middleware/auth.middleware.js";

const chargerPointRouter = Router();

chargerPointRouter.get("/", getAllChargerPoints);
chargerPointRouter.get("/status/:status", getAllChargerPointsByStatus);
chargerPointRouter.get("/id/:id", getChargerPointById);
chargerPointRouter.get(
  "/location/:lat/:lon/{radius}",
  getChargerPointByLocation,
);

chargerPointRouter.post("/", authMiddleware, requireRole("admin"), addChargerPoint);

export default chargerPointRouter;
