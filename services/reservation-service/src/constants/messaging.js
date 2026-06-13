export const MessageQueues = Object.freeze({
  RESERVATION: "reservation.management.queue",
});

export const Exchanges = Object.freeze({
  RESERVATION: "reservation",
});

export const RoutingKeys = Object.freeze({
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled",
  RESERVATION_COMPLETED: "reservation.completed",
});
