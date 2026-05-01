export const MessageQueues = Object.freeze({
  CHARGER: "charger.management.queue",
});

export const Exchanges = Object.freeze({
  CHARGER: "charger",
  RESERVATION: "reservation",
});

export const RoutingKeys = Object.freeze({
  CHARGER_UPDATE: "charger.update",
  CHARGER_DELETE: "charger.delete",
  CHARGER_ADD: "charger.add",
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled",
});
