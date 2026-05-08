import AnalyticsService from "../services/analytics.service.js";

/**
 * Handles GET /admin/analytics/stats
 * Returns aggregated global statistics for providers and chargers.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON snapshot of global stats
 */
export const getGlobalStats = async (req, res) => {
  const stats = await AnalyticsService.getGlobalStats();
  res.json(stats);
};

/**
 * Handles GET /admin/analytics/providers
 * Returns per-provider charger counts broken down by status.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>} Sends JSON breakdown of chargers per provider
 */
export const getProviderBreakdown = async (req, res) => {
  const breakdown = await AnalyticsService.getProviderChargerBreakdown();
  res.json(breakdown);
};
