import { Router } from "express";
import { getProviderReport, getAllProvidersReport, getGlobalReport, getProviderHistory, getGlobalHistory } from "../controllers/analytics.controller.js";
import { requireProviderAuth, requireSelfProvider } from "../middleware/auth.middleware.js";

const analyticsRouter = Router();

analyticsRouter.get("/global",                           requireProviderAuth, getGlobalReport);
analyticsRouter.get("/providers",                        requireProviderAuth, getAllProvidersReport);
analyticsRouter.get("/history/global",                   requireProviderAuth, getGlobalHistory);
analyticsRouter.get("/history/provider/:providerName",   requireProviderAuth, requireSelfProvider, getProviderHistory);
analyticsRouter.get("/provider/:providerName",           requireProviderAuth, requireSelfProvider, getProviderReport);

export default analyticsRouter;
