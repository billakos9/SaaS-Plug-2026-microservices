import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware.js";

import { register, login, getProfile, getAllAdmins, updateAdmin, deleteAdmin } from "../controllers/auth.controller.js";
import { getGlobalStats, getProviderBreakdown } from "../controllers/analytics.controller.js";
import {
  getAllProviders, getProviderById, registerProvider, updateProvider, deleteProvider,
  getAllUsers, getUserById, deleteUser,
  getAllChargers, getChargerById, getChargersByStatus,
} from "../controllers/management.controller.js";

const adminRouter = Router();

// ── Auth (public) ─────────────────────────────────────────────────────────────
adminRouter.post("/register", register);
adminRouter.post("/login",    login);

// All routes below require a valid admin JWT
adminRouter.use(authMiddleware);

// ── Admin account management ──────────────────────────────────────────────────
adminRouter.get( "/profile",       getProfile);
adminRouter.get( "/accounts",      getAllAdmins);
adminRouter.put( "/accounts/:id",  updateAdmin);
adminRouter.delete("/accounts/:id", deleteAdmin);

// ── Global analytics ──────────────────────────────────────────────────────────
adminRouter.get("/analytics",             getGlobalStats);
adminRouter.get("/analytics/providers",   getProviderBreakdown);

// ── Provider management ───────────────────────────────────────────────────────
adminRouter.get(   "/providers",     getAllProviders);
adminRouter.get(   "/providers/:id", getProviderById);
adminRouter.post(  "/providers",     registerProvider);
adminRouter.put(   "/providers/:id", updateProvider);
adminRouter.delete("/providers/:id", deleteProvider);

// ── User management ───────────────────────────────────────────────────────────
adminRouter.get(   "/users",     getAllUsers);
adminRouter.get(   "/users/:id", getUserById);
adminRouter.delete("/users/:id", deleteUser);

// ── Charger management (read-only) ────────────────────────────────────────────
adminRouter.get("/chargers",                 getAllChargers);
adminRouter.get("/chargers/status/:status",  getChargersByStatus);
adminRouter.get("/chargers/:id",             getChargerById);

export default adminRouter;
