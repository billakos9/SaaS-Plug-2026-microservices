export const MessageQueues = Object.freeze({
  USER_DELETE:    "reservation.user.delete.queue",
  CHARGER_CACHE:  "reservation.charger.cache.queue",
});

export const Exchanges = Object.freeze({
  RESERVATION: "reservation",
  USER:        "user",
  CHARGER:     "charger",
});

export const RoutingKeys = Object.freeze({
  RESERVATION_CREATED:   "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled",
  RESERVATION_COMPLETED: "reservation.completed",
  USER_DELETED:          "user.deleted",
  CHARGER_ADD:           "charger.add",
  CHARGER_UPDATE:        "charger.update",
});
