import http from "./http";

export async function getGlobalReport(period) {
  const params = period ? `?period=${period}` : '';
  const res = await http.get(`/analytics/global${params}`);
  return res.data;
}

export async function getAllProvidersReport(period) {
  const params = period ? `?period=${period}` : '';
  const res = await http.get(`/analytics/providers${params}`);
  return res.data;
}

export async function getProviderReport(providerName, period) {
  if (!providerName) throw new Error("Provider name is required");
  const params = period ? `?period=${period}` : '';
  const res = await http.get(`/analytics/provider/${providerName}${params}`);
  return res.data;
}

export async function getGlobalHistory() {
  const res = await http.get('/analytics/history/global');
  return res.data;
}

export async function getProviderHistory(providerName) {
  if (!providerName) throw new Error('Provider name is required');
  const res = await http.get(`/analytics/history/provider/${providerName}`);
  return res.data;
}

export async function getSessions() {
  return [];
}

export async function getDashboardStats() {
  return { overview: { totalEnergyKWh: 0, avgSessionMinutes: 0, totalSessions: 0 }, trends: [] };
}

export async function getMyAnalytics() {
  return { totalEnergyKWh: 0, totalSessions: 0, trends: [] };
}
