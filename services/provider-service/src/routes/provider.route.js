import { Router } from "express";

import {
  getAllProviders,
  getProviderById,
  registerProvider,
  updateProvider,
  deleteProvider,
} from "../controllers/provider.controller.js";

const providerRouter = Router();

providerRouter.get("/",           getAllProviders);
providerRouter.get("/:id",        getProviderById);
providerRouter.post("/register",  registerProvider);
providerRouter.put("/update/:id", updateProvider);
providerRouter.delete("/delete/:id", deleteProvider);

export default providerRouter;
