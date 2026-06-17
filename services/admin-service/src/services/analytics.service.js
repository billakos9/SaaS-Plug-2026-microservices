import { PROVIDER_SERVICE_URL, ANALYTICS_SERVICE_URL } from "../config/env.js";

/**
 * Fetches data from a downstream service.
 * Returns null on failure so analytics can degrade gracefully.
 * @param {String} url 
 * @param {String|null} token
 * @returns {Promise<Object|null>} The fetched data or null on failure.
 */
async function safeFetch(url, token = null) {
  try {
    const headers = {};
    if (token) headers["Authorization"] = token;
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
       console.error(`[analytics-fetch] ${url} failed with ${res.status}`);
       return null;
    }
    return res.json();
  } catch (err) {
    console.error(`[analytics-fetch] ${url} exception:`, err.message);
    return null;
  }
}
/**
 * AnalyticsService provides methods to aggregate and retrieve statistics about providers and chargers by querying the respective downstream services. It includes error handling to allow for graceful degradation if the downstream services are unavailable. The getGlobalStats method returns overall counts and status breakdowns, while getProviderChargerBreakdown provides a per-provider analysis of charger counts and statuses.
 */
class AnalyticsService {
  /**
   * Aggregates global statistics by querying the provider, charger, and analytics services.
   *
   * @param {String|null} token - Authorization token to pass to downstream services
   * @returns {Promise<Object>} Aggregated stats snapshot
   */
  static async getGlobalStats(token = null) {
    const [providers, globalReport] = await Promise.all([
      safeFetch(`${PROVIDER_SERVICE_URL}/provider`, token),
      safeFetch(`${ANALYTICS_SERVICE_URL}/analytics/global`, token),
    ]);

    const providerStats = {
      total: providers?.length ?? "unavailable",
    };

    const chargerStats = globalReport?.chargersByStatus
      ? { total: globalReport.totalChargers ?? 0, byStatus: globalReport.chargersByStatus }
      : { total: "unavailable" };

    return {
      providers:   providerStats,
      chargers:    chargerStats,
      totalRevenue: globalReport?.totalRevenue ?? 0,
      totalEnergyKWh: globalReport?.totalEnergyKwh ?? 0,
      totalSessions: globalReport?.totalReservations ?? 0,
      avgSessionDuration: globalReport?.averageDurationMinutes ?? 0,
      activeChargers: (globalReport?.chargersByStatus?.charging ?? 0) + (globalReport?.chargersByStatus?.reserved ?? 0),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns per-provider charger counts.
   * @param {String|null} token
   * @returns {Promise<Object>} The breakdown data or an error indicator.
   */
  static async getProviderChargerBreakdown(token = null) {
    const [providers, providersReport] = await Promise.all([
      safeFetch(`${PROVIDER_SERVICE_URL}/provider`, token),
      safeFetch(`${ANALYTICS_SERVICE_URL}/analytics/providers`, token),
    ]);

    if (!Array.isArray(providers)) {
      return { available: false };
    }

    const providerReportMap = {};
    if (providersReport?.providers) {
      providersReport.providers.forEach(p => {
        providerReportMap[p.providerName] = p;
      });
    }

    const breakdown = providers.map((p) => {
      const report = providerReportMap[p.providerName];
      return {
        providerId:       p.providerId,
        providerName:     p.providerName,
        totalChargers:    report?.totalChargers ?? 0,
        chargersByStatus: report?.chargersByStatus ?? {},
        totalRevenue:     report?.totalRevenue ?? 0,
        totalEnergyKWh:   report?.totalEnergyKwh ?? 0,
      };
    });

    return breakdown;
  }
}

export default AnalyticsService;
