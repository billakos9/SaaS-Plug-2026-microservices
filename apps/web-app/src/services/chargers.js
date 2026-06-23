import http from "./http";
import { API_ENDPOINTS } from "../config/api";
import { DEFAULT_CHARGER } from "../config/constants";

/**
 * Normalizes charger data.
 */
export function normalizeChargerSync(charger) {
  if (!charger) return null;

  let lat = parseFloat(charger.latitude);
  let lon = parseFloat(charger.longitude);
  let address = charger.address || "Unknown";

  return {
    id: charger.id,
    providerName: charger.ProviderName || charger.providerName || "Premium Provider",
    longitude: lon,
    latitude: lat,
    status: charger.status || "available",
    capacityKw: charger.cap || charger.capacityKw || DEFAULT_CHARGER.capacityKw,
    kwhPrice: charger.kwhPrice || DEFAULT_CHARGER.kwhPrice,
    address: address,
    locationName: charger.locationName || `Station ${charger.id}`,
    connectionType: charger.connectionType || DEFAULT_CHARGER.connectionType,
    raw: charger
  };
}

/**
 * Fetches all chargers.
 */
export async function getChargers() {
  try {
    const res = await http.get(API_ENDPOINTS.chargers.list);
    const data = Array.isArray(res.data) ? res.data : [];
    return data.map(normalizeChargerSync);
  } catch (error) {
    console.error("Failed to fetch chargers:", error);
    return [];
  }
}

/**
 * Fetches chargers by their current status.
 */
export async function getChargersByStatus(status) {
  try {
    const res = await http.get(API_ENDPOINTS.chargers.byStatus(status));
    const data = Array.isArray(res.data) ? res.data : [];
    return data.map(normalizeChargerSync);
  } catch (error) {
    console.error(`Failed to fetch chargers by status ${status}:`, error);
    return [];
  }
}

/**
 * Fetches chargers belonging to a specific provider.
 */
export async function getChargersByProvider(providerId) {
  try {
    const res = await http.get(API_ENDPOINTS.chargers.byProvider(providerId));
    const data = Array.isArray(res.data) ? res.data : [];
    return data.map(normalizeChargerSync);
  } catch (error) {
    console.error(`Failed to fetch chargers for provider ${providerId}:`, error);
    return [];
  }
}

export async function getChargerById(id) {
  try {
    const res = await http.get(API_ENDPOINTS.chargers.byId(id));
    if (!res.data) return null;
    return normalizeChargerSync(res.data);
  } catch (error) {
    console.error(`Failed to fetch charger ${id}:`, error);
    return null;
  }
}

// Backward compatibility
export const normalizeCharger = async (charger) => {
    return normalizeChargerSync(charger);
};
