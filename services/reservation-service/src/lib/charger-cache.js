import { CHARGER_SERVICE_URL } from "../config/env.js";

// In-memory read-model for charger availability.
// Populated at startup via prewarm() and kept current by charger.add / charger.update events.
const cache = new Map(); // id (Number) → { status, kwhPrice, locationName, capacityKw, providerName }

export function upsert(charger) {
  cache.set(Number(charger.id), {
    status:       charger.status,
    kwhPrice:     charger.kwhPrice ?? 0,
    locationName: charger.locationName ?? "",
    capacityKw:   charger.cap ?? charger.capacityKw ?? 22,
    providerName: charger.ProviderName ?? charger.providerName ?? "",
  });
}

export function get(id) {
  return cache.get(Number(id)) ?? null;
}

// Fetches all chargers from charger-service once on startup to pre-fill the cache.
// Non-fatal: if charger-service is unavailable the cache fills from RabbitMQ events instead.
export async function prewarm() {
  try {
    const res = await fetch(`${CHARGER_SERVICE_URL}/charger`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;
    const chargers = await res.json();
    for (const c of chargers) upsert(c);
    console.log(`[charger-cache] pre-warmed ${cache.size} chargers`);
  } catch (err) {
    console.warn("[charger-cache] pre-warm failed — cache will fill from RabbitMQ events:", err.message);
  }
}
