import http from "./http";

/**
 * Fetches analytics report for all providers (Provider Admin access).
 * Backend route: GET /analytics/providers
 */
export async function getAllProvidersReport() {
  const res = await http.get("/analytics/providers");
  return res.data;
}

/**
 * Fetches analytics report for a specific provider.
 * Backend route: GET /analytics/provider/:providerName
 */
export async function getProviderReport(providerName) {
  if (!providerName) throw new Error("Provider name is required");
  const res = await http.get(`/analytics/provider/${providerName}`);
  return res.data;
}

/**
 * Legacy User Analytics: MOCKED
 * The backend no longer supports dedicated user analytics endpoints.
 * These are kept as empty implementations to prevent frontend crashes.
 */

export async function getSessions() {
  console.warn("getSessions is deprecated. Returning empty list.");
  return [];
}

export async function getDashboardStats() {
  console.warn("getDashboardStats is deprecated. Returning empty stats.");
  return {
    overview: {
      totalEnergyKWh: 0,
      avgSessionMinutes: 0,
      totalSessions: 0,
    },
    trends: [],
  };
}

export async function getMyAnalytics() {
  console.warn("getMyAnalytics is deprecated. Use reservation history instead.");
  return { totalEnergyKWh: 0, totalSessions: 0, trends: [] };
}
