import { Router } from "express";
import {
  getAllChargerPoints,
  reserveChargerPoint,
} from "../controllers/red-plug-adapter.controller.js";

const redPlugRouter = Router();

/**
 * Adapter routes for the redPlug provider.
 */
redPlugRouter.get("/fetchPoints", getAllChargerPoints);
redPlugRouter.post("/postReservations", reserveChargerPoint);

export default redPlugRouter;
