import { Router } from "express";

import {
  getChargerPointById,
  getChargerPointByLocation,
  addChargerPoint,
  getAllChargerPoints,
  getAllChargerPointsByStatus,
} from "../controllers/charger-point.controller.js";

const chargerPointRouter = Router();

chargerPointRouter.get("/", getAllChargerPoints);
chargerPointRouter.get("/status/:status", getAllChargerPointsByStatus);
chargerPointRouter.get("/id/:id", getChargerPointById);
chargerPointRouter.get("/location/:lat/:lon", getChargerPointByLocation);

chargerPointRouter.post("/", addChargerPoint);

export default chargerPointRouter;
