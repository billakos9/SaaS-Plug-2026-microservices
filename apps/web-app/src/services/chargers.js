import http from "./http";

// patern matching
const stripAccents = (text) => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
};

// get charger object from backend (lat long?)
// convert to frontend show
const normalizeCharger = (charger) => {
  const lat = charger.lat ?? charger.latitude ?? null;
  const lon = charger.lon ?? charger.longitude ?? null;

  const addressParts = [
    charger.name,
    charger.locality,
    charger.road,
    charger.location,
  ].filter(Boolean);

  return {
    id: String(charger.pointid ?? charger.pointId ?? charger.id ?? ""),
    provider: charger.providerName || charger.provider || "Unknown provider",
    status: charger.status || "unknown",
    latitude: lat ? Number(lat) : null,
    longitude: lon ? Number(lon) : null,
    capacityKw: charger.cap ?? charger.capacity ?? charger.capacityKw ?? null,
    power: charger.cap ?? charger.capacity ?? charger.capacityKw ?? null,
    location:
      addressParts.join(" • ") || (lat && lon ? `${lat}, ${lon}` : null),
    reservationEndTime:
      charger.reservationendtime ?? charger.reservationEndTime ?? null,
    price: charger.kwhprice ?? charger.price ?? null,
    raw: charger,
  };
};

// filter by status
export async function getChargersByStatus(status) {
  const res = await http.get("/chargers/points", {
    params: {
      ...(status ? { status } : {}),
      format: "json",
    },
  });

  const payload = res.data?.points || res.data?.chargers || res.data;
  const data = Array.isArray(payload) ? payload : [];
  return data.map(normalizeCharger);
}

// filter by chargerID
export async function getChargerById(chargerId) {
  const res = await http.get(`/chargers/point/${chargerId}`, {
    params: { format: "json" },
  });

  const payload = res.data?.point || res.data?.charger || res.data;
  return normalizeCharger(payload ?? {});
}


export async function getChargers(filters = {}) {
  const chargers = await getChargersByStatus(filters.status);
  const query = filters.query?.trim();

  if (!query) return chargers;

  const normalizedQuery = stripAccents(query);
  
  // client side filtering
  return chargers.filter((charger) => {
    const haystack = [
      charger.id,
      charger.provider,
      charger.location,
      charger.raw?.name,
      charger.raw?.locality,
      charger.raw?.road,
    ]
      .filter(Boolean)
      .map((value) => stripAccents(String(value)));

    return haystack.some((value) => value.includes(normalizedQuery));
  });
}

export { normalizeCharger };
