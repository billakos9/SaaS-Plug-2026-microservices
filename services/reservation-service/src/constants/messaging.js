export const MessageQueues = Object.freeze({
  USER_DELETE: "reservation.user.delete.queue",
});

export const Exchanges = Object.freeze({
  RESERVATION: "reservation",
  USER:        "user",
});

export const RoutingKeys = Object.freeze({
  RESERVATION_CREATED:   "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled",
  RESERVATION_COMPLETED: "reservation.completed",
  USER_DELETED:          "user.deleted",
});
