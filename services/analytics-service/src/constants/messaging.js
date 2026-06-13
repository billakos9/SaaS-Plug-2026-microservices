export const Exchanges = Object.freeze({
  RESERVATION: "reservation",
});

export const MessageQueues = Object.freeze({
  ANALYTICS_RESERVATION: "analytics.reservation.queue",
});

export const RoutingKeys = Object.freeze({
  RESERVATION_CREATED:   "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled",
  RESERVATION_COMPLETED: "reservation.completed",
});
