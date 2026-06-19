import { CHARGER_SERVICE_URL } from "../config/env.js";
import AnalyticStatRepository from "../repositories/analytic-stat.repository.js";

async function safeFetch(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function buildFleetStats(chargers) {
  const chargersByStatus = chargers.reduce((acc, c) => {
    const s = c.status ?? "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const totalChargers = chargers.length;
  const utilizationRate = totalChargers > 0
    ? Math.round((1 - (chargersByStatus.available ?? 0) / totalChargers) * 100) / 100
    : 0;

  const prices = chargers.map(c => c.kwhPrice).filter(p => typeof p === "number" && p >= 0);
  const averageKwhPrice = prices.length > 0
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100
    : 0;

  return { totalChargers, chargersByStatus, utilizationRate, averageKwhPrice };
}

function buildReservationStats(stat) {
  const totalReservations    = stat?.totalReservations ?? 0;
  const totalDurationMinutes = stat?.totalDurationMinutes ?? 0;
  const totalEnergyKwh       = Math.round((stat?.totalEnergyKwh ?? 0) * 100) / 100;
  const totalRevenue         = Math.round((stat?.totalRevenue ?? 0) * 100) / 100;
  const averageDurationMinutes = totalReservations > 0
    ? Math.round(totalDurationMinutes / totalReservations * 10) / 10
    : 0;
  return { totalReservations, averageDurationMinutes, totalRevenue, totalEnergyKwh };
}

class AnalyticsService {
  static async getProviderReport(providerName, period) {
    // DB check first — only call charger-service when a stat record exists for
    // this provider+period combination. Avoids the HTTP round-trip on a cache miss.
    const stat = await AnalyticStatRepository.getByProviderAndPeriod(providerName, period);

    const allChargers = stat
      ? await safeFetch(`${CHARGER_SERVICE_URL}/charger`)
      : null;

    const providerChargers = Array.isArray(allChargers)
      ? allChargers.filter(c => c.ProviderName === providerName)
      : [];

    return {
      providerName,
      period,
      ...buildFleetStats(providerChargers),
      ...buildReservationStats(stat),
    };
  }

  static async getAllProvidersReport(period) {
    const [stats, allChargers] = await Promise.all([
      AnalyticStatRepository.getAllByPeriod(period),
      safeFetch(`${CHARGER_SERVICE_URL}/charger`),
    ]);

    const chargersByProvider = {};
    if (Array.isArray(allChargers)) {
      for (const c of allChargers) {
        const p = c.ProviderName;
        if (!chargersByProvider[p]) chargersByProvider[p] = [];
        chargersByProvider[p].push(c);
      }
    }

    const allProviders = new Set([
      ...Object.keys(chargersByProvider),
      ...stats.map(s => s.providerName),
    ]);

    const statMap = Object.fromEntries(stats.map(s => [s.providerName, s]));

    return {
      period,
      providers: [...allProviders].map(name => ({
        providerName: name,
        period,
        ...buildFleetStats(chargersByProvider[name] ?? []),
        ...buildReservationStats(statMap[name]),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  static async getProviderHistory(providerName) {
    const stats = await AnalyticStatRepository.getAllByProvider(providerName);
    return stats.map(s => ({
      period:            s.period,
      totalReservations: s.totalReservations,
      totalEnergyKwh:    Math.round((s.totalEnergyKwh ?? 0) * 100) / 100,
      totalRevenue:      Math.round((s.totalRevenue ?? 0) * 100) / 100,
    }));
  }

  static async getGlobalHistory() {
    const stats = await AnalyticStatRepository.getAll();
    const acc = {};
    for (const s of stats) {
      if (!acc[s.period]) acc[s.period] = { period: s.period, totalReservations: 0, totalEnergyKwh: 0, totalRevenue: 0 };
      acc[s.period].totalReservations += s.totalReservations ?? 0;
      acc[s.period].totalEnergyKwh    += s.totalEnergyKwh ?? 0;
      acc[s.period].totalRevenue      += s.totalRevenue ?? 0;
    }
    return Object.values(acc)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(s => ({
        period:            s.period,
        totalReservations: s.totalReservations,
        totalEnergyKwh:    Math.round(s.totalEnergyKwh * 100) / 100,
        totalRevenue:      Math.round(s.totalRevenue * 100) / 100,
      }));
  }

  static async getGlobalReport(period) {
    const [stats, allChargers] = await Promise.all([
      AnalyticStatRepository.getAllByPeriod(period),
      safeFetch(`${CHARGER_SERVICE_URL}/charger`),
    ]);

    const totalFleet = buildFleetStats(allChargers ?? []);
    
    const aggregatedReservation = stats.reduce((acc, s) => {
      acc.totalReservations += (s.totalReservations ?? 0);
      acc.totalDurationMinutes += (s.totalDurationMinutes ?? 0);
      acc.totalEnergyKwh += (s.totalEnergyKwh ?? 0);
      acc.totalRevenue += (s.totalRevenue ?? 0);
      return acc;
    }, { totalReservations: 0, totalDurationMinutes: 0, totalEnergyKwh: 0, totalRevenue: 0 });

    return {
      period,
      ...totalFleet,
      ...buildReservationStats(aggregatedReservation),
      providerCount: stats.length,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default AnalyticsService;
