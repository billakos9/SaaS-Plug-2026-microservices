import http from "./http";


const normalizeReservation = (reservation) => {
  const chargerId =
    reservation.pointid ??
    reservation.pointId ??
    reservation.chargerId ??
    reservation.charger?.id ??
    null;
  const endTime =
    reservation.endTime ??
    reservation.endtime ??
    reservation.reservationendtime ??
    reservation.reservationEndTime ??
    null;

  return {
    id: reservation.reservationId ?? reservation.id ?? null,
    chargerId,
    pointId: chargerId,
    userId: reservation.userInfoId ?? reservation.userId ?? null,
    status: reservation.status ?? "unknown",
    startTime: reservation.startTime ?? reservation.starttime ?? null,
    endTime,
    reservationEndTime: endTime,
    raw: reservation,
  };
};


export async function createReservation({ chargerId, minutes }) {
  if (!chargerId) {
    throw new Error("A chargerId is required to create a reservation");
  }

  const res = await http.post("/reservations", {
    chargerId,
    minutes,
  });

  return normalizeReservation(res.data ?? {});
}


export async function cancelReservation(reservationId) {
  if (!reservationId) {
    throw new Error("A reservationId is required to cancel a reservation");
  }

  const res = await http.delete(`/reservations/${reservationId}`);
  return res.data;
}


export async function getMyReservations() {
  const res = await http.get("/reservations/me");
  const payload = res.data?.reservations || res.data;
  const data = Array.isArray(payload) ? payload : [];
  return data.map(normalizeReservation);
}

export { normalizeReservation };
