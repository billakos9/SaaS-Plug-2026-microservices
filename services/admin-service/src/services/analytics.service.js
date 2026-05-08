import { PROVIDER_SERVICE_URL, CHARGER_SERVICE_URL } from "../config/env.js";

/**
 * Fetches data from a downstream service.
 * Returns null on failure so analytics can degrade gracefully.
 * @param {String} url 
 * @returns {Promise<Object|null>} The fetched data or null on failure.
 */
async function safeFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
/**
 * AnalyticsService provides methods to aggregate and retrieve statistics about providers and chargers by querying the respective downstream services. It includes error handling to allow for graceful degradation if the downstream services are unavailable. The getGlobalStats method returns overall counts and status breakdowns, while getProviderChargerBreakdown provides a per-provider analysis of charger counts and statuses.
 */
class AnalyticsService {
  /**
   * Aggregates global statistics by querying the provider and charger services.
   *
   * @returns {Promise<Object>} Aggregated stats snapshot
   */
  static async getGlobalStats() {
    const [providers, chargers] = await Promise.all([
      safeFetch(`${PROVIDER_SERVICE_URL}/provider`),
      safeFetch(`${CHARGER_SERVICE_URL}/charger`),
    ]);

    const providerStats = {
      total: providers?.length ?? "unavailable",
    };

    let chargerStats = { total: "unavailable" };

    if (Array.isArray(chargers)) {
      const byStatus = chargers.reduce((acc, c) => {
        const s = c.status ?? "unknown";
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {});

      chargerStats = {
        total:   chargers.length,
        byStatus,
      };
    }

    return {
      providers:   providerStats,
      chargers:    chargerStats,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns per-provider charger counts.
   * @returns {Promise<Object>} The breakdown data or an error indicator.
   */
  static async getProviderChargerBreakdown() {
    const [providers, chargers] = await Promise.all([
      safeFetch(`${PROVIDER_SERVICE_URL}/provider`),
      safeFetch(`${CHARGER_SERVICE_URL}/charger`),
    ]);

    if (!Array.isArray(providers) || !Array.isArray(chargers)) {
      return { available: false };
    }

    const breakdown = providers.map((p) => {
      const providerChargers = chargers.filter(
        (c) => c.ProviderName === p.providerName,
      );

      const byStatus = providerChargers.reduce((acc, c) => {
        const s = c.status ?? "unknown";
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {});

      return {
        providerId:   p.providerId,
        providerName: p.providerName,
        total:        providerChargers.length,
        byStatus,
      };
    });

    return { breakdown, generatedAt: new Date().toISOString() };
  }
}

export default AnalyticsService;
