import http from "./http";
import { getChargerById } from "./chargers";

/**
 * Normalizes a reservation from the backend DTO.
 * Backend DTO fields: reservationId, userId, chargerId, providerName, duration, kwhPrice, status, createdAt, updatedAt
 */
const normalizeReservation = (reservation) => {
  if (!reservation) return null;

  return {
    id: reservation.reservationId,
    chargerId: reservation.chargerId,
    userId: reservation.userId,
    providerName: reservation.providerName,
    status: reservation.status,
    duration: reservation.duration,
    kwhPrice: reservation.kwhPrice,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    // Legacy support for UI components expecting startTime/endTime
    startTime: reservation.createdAt,
    endTime: reservation.updatedAt, 
    raw: reservation,
  };
};

/**
 * Creates a new reservation.
 * Logic: Fetches the charger first to derive the providerName.
 * Backend route: POST /reservation/ (mapped via gateway to /api/reservations)
 */
export async function createReservation({ chargerId, minutes }) {
  if (!chargerId) {
    throw new Error("A chargerId is required to create a reservation");
  }

  // 1. Fetch charger details to get providerName
  const charger = await getChargerById(chargerId);
  if (!charger) {
    throw new Error(`Charger with ID ${chargerId} not found`);
  }

  // 2. Submit reservation with required fields
  const res = await http.post("/reservations", {
    chargerId: Number(chargerId),
    duration: minutes || 60,
    providerName: charger.providerName,
  });

  return normalizeReservation(res.data);
}

/**
 * Fetches reservations for the authenticated user.
 * Backend route: GET /reservation/user/:userId (mapped via gateway to /api/reservations/user/:userId)
 */
export async function getMyReservations(userId) {
  if (!userId) {
    throw new Error("User ID is required to fetch reservations");
  }
  
  const res = await http.get(`/reservations/user/${userId}`);
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(normalizeReservation);
}

/**
 * Fetches a single reservation by ID.
 * Backend route: GET /reservation/:id
 */
export async function getReservationById(id) {
  if (!id) throw new Error("Reservation ID is required");
  const res = await http.get(`/reservations/${id}`);
  return normalizeReservation(res.data);
}

/**
 * Mocked cancellation (Backend does not support this yet).
 */
export async function cancelReservation(reservationId) {
  console.warn("cancelReservation: Not implemented in backend yet", reservationId);
  return { success: false, message: "Cancellation not yet supported." };
}

export { normalizeReservation };
