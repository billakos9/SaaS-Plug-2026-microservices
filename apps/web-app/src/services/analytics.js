import http from "./http";

//helper for date endpoints
const formatDate = (value, { compact = false, required = false } = {}) => {
  if (!value) {
    if (required) throw new Error("Both from and to dates are required");
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      if (required) throw new Error("Both from and to dates are required");
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return compact ? trimmed.replaceAll("-", "") : trimmed;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }

  const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;

  return compact ? formatted.replaceAll("-", "") : formatted;
};

// query params object creator
const buildAnalyticsParams = ({ providerId, chargerId, from, to } = {}) => {
  const params = {};
  const fromParam = formatDate(from);
  const toParam = formatDate(to);

  if (providerId) params.providerId = providerId;
  if (chargerId) params.chargerId = chargerId;
  if (fromParam) params.from = fromParam;
  if (toParam) params.to = toParam;

  return params;
};

// backend response on analytics (not normalized)
export async function getMyAnalytics(filters = {}) {
  const res = await http.get("/analytics/me", {
    params: buildAnalyticsParams(filters),
  });

  return res.data;
}

// raw provider backend data
export async function getProviderAnalytics(filters = {}) {
  const res = await http.get("/analytics/provider", {
    params: buildAnalyticsParams(filters),
  });

  return res.data;
}

// operator/admin use case
export async function getGlobalAnalytics(filters = {}) {
  const res = await http.get("/analytics/global", {
    params: buildAnalyticsParams(filters),
  });

  return res.data;
}


export async function getSessions({ pointId, from, to } = {}) {
  if (!pointId) {
    throw new Error("A pointId is required to fetch sessions");
  }

  const res = await http.get(
    `/analytics/sessions/${pointId}/${formatDate(from, {
      compact: true,
      required: true,
    })}/${formatDate(to, { compact: true, required: true })}`,
    { params: { format: "json" } }
  );

  return Array.isArray(res.data) ? res.data : [];
}


export async function getDashboardStats({ pointId, from, to } = {}) {
  const params = {};
  const normalizedPointId = String(pointId ?? "").trim();
  const fromParam = formatDate(from);
  const toParam = formatDate(to);

  if (normalizedPointId) params.pointId = normalizedPointId;
  if (fromParam) params.from = fromParam;
  if (toParam) params.to = toParam;

  const res = await http.get("/analytics/stats", { params });
  const overview = res.data?.overview || {};
  const trends = Array.isArray(res.data?.trends) ? res.data.trends : [];

  return {
    overview: {
      userEmail: overview.userEmail || "",
      username: overview.username || "",
      totalEnergyKWh: Number(overview.totalEnergyKWh) || 0,
      avgSessionMinutes: Number(overview.avgSessionMinutes) || 0,
      totalSessions: Number.parseInt(overview.totalSessions, 10) || 0,
    },
    trends: trends.map((entry) => ({
      month: entry.month,
      energyKWh: Number(entry.energyKWh) || 0,
    })),
  };
}
