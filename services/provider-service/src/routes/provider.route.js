import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware.js";
import {
  getAllProviders,
  getProviderById,
  registerProvider,
  updateProvider,
  deleteProvider,
} from "../controllers/provider.controller.js";

const providerRouter = Router();

providerRouter.use(authMiddleware);
providerRouter.get("/",              getAllProviders);
providerRouter.get("/:id",           getProviderById);
providerRouter.post("/register",     requireRole("admin"), registerProvider);
providerRouter.put("/update/:id",    requireRole("admin"), updateProvider);
providerRouter.delete("/delete/:id", requireRole("admin"), deleteProvider);

export default providerRouter;
