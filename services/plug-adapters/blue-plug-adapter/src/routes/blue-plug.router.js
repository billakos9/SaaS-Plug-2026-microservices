import { Router } from "express";
import { getAllChargerPoints, reserveChargerPoint } from "../controllers/blue-plug-adapter.controller.js";


const bluePlugRouter = Router();

bluePlugRouter.get("/fetchPoints", getAllChargerPoints);

bluePlugRouter.post("/postReservations", reserveChargerPoint);

export default bluePlugRouter;
