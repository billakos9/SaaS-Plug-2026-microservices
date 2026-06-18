import AnalyticsService from "../services/analytics.service.js";
import {
  USER_SERVICE_URL, CHARGER_SERVICE_URL, PROVIDER_SERVICE_URL,
  ANALYTICS_SERVICE_URL, AUTH_SERVICE_URL, RESERVATION_SERVICE_URL,
  PLUG_SERVICE_URL, BLUE_PLUG_ADAPTER_URL, RED_PLUG_ADAPTER_URL, GREEN_PLUG_ADAPTER_URL,
  BILLING_SERVICE_URL,
} from "../config/env.js";

/**
 * Handles GET /admin/analytics/stats
 * Returns aggregated global statistics for providers and chargers.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON snapshot of global stats
 */
export const getGlobalStats = async (req, res, next) => {
  try {
    const token = req.headers["authorization"];
    const stats = await AnalyticsService.getGlobalStats(token);
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

/**
 * Handles GET /admin/analytics/providers
 * Returns per-provider charger counts broken down by status.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON breakdown of chargers per provider
 */
export const getProviderBreakdown = async (req, res, next) => {
  try {
    const token = req.headers["authorization"];
    const breakdown = await AnalyticsService.getProviderChargerBreakdown(token);
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
};

const SERVICE_HEALTH_TARGETS = [
  { label: "Identity & Auth",    url: () => `${AUTH_SERVICE_URL}/health` },
  { label: "User Registry",      url: () => `${USER_SERVICE_URL}/health` },
  { label: "Station Hub",        url: () => `${CHARGER_SERVICE_URL}/health` },
  { label: "Provider Network",   url: () => `${PROVIDER_SERVICE_URL}/health` },
  { label: "Reservation Engine", url: () => `${RESERVATION_SERVICE_URL}/health` },
  { label: "Energy Analytics",   url: () => `${ANALYTICS_SERVICE_URL}/health` },
  { label: "Plug Orchestrator",  url: () => `${PLUG_SERVICE_URL}/health` },
  { label: "bluePlug Adapter",   url: () => `${BLUE_PLUG_ADAPTER_URL}/health` },
  { label: "redPlug Adapter",    url: () => `${RED_PLUG_ADAPTER_URL}/health` },
  { label: "greenPlug Adapter",  url: () => `${GREEN_PLUG_ADAPTER_URL}/health` },
  { label: "Billing Engine",     url: () => `${BILLING_SERVICE_URL}/health` },
];

export const getSystemHealth = async (_req, res, next) => {
  try {
    const checks = await Promise.allSettled(
      SERVICE_HEALTH_TARGETS.map(({ url }) =>
        fetch(url(), { signal: AbortSignal.timeout(3000) }).then(r => r.ok ? "operational" : "degraded")
      )
    );

    const result = {};
    SERVICE_HEALTH_TARGETS.forEach(({ label }, i) => {
      result[label] = checks[i].status === "fulfilled" ? checks[i].value : "unreachable";
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
