import { Router } from "express";
import { requireProviderAuth } from "../middleware/auth.middleware.js";
import { postGenerate, getByProvider, getAll, patchMarkPaid, patchPayAsProvider, getDetail } from "../controllers/invoice.controller.js";
import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";

const invoiceRouter = Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return next(new AppError(HttpCode.FORBIDDEN, "Admin access only"));
  }
  next();
}

function requireProvider(req, res, next) {
  if (req.user?.role !== "provider") {
    return next(new AppError(HttpCode.FORBIDDEN, "Provider access only"));
  }
  next();
}

// Admin-only routes
invoiceRouter.post(  "/generate",           requireProviderAuth, requireAdmin,    postGenerate);
invoiceRouter.get(   "/",                   requireProviderAuth, requireAdmin,    getAll);
invoiceRouter.patch( "/:invoiceId/paid",    requireProviderAuth, requireAdmin,    patchMarkPaid);

// Provider self-access routes
invoiceRouter.get(   "/my",                 requireProviderAuth, requireProvider, getByProvider);
invoiceRouter.patch( "/:invoiceId/pay",     requireProviderAuth, requireProvider, patchPayAsProvider);

// Accessible by admin OR the owning provider
invoiceRouter.get(   "/:invoiceId/detail",  requireProviderAuth, getDetail);

export default invoiceRouter;
