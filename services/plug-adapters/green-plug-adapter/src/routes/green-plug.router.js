import { Router } from "express";
import {
  getAllChargerPoints,
  reserveChargerPoint,
} from "../controllers/green-plug-adapter.controller.js";

const greenPlugRouter = Router();

/**
 * Adapter routes for the greenPlug provider.
 */
greenPlugRouter.get("/fetchPoints", getAllChargerPoints);
greenPlugRouter.post("/postReservations", reserveChargerPoint);

export default greenPlugRouter;
