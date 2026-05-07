/**
 * A class containing all the available rabbitMQ message queues.
 */
export const MessageQueues = Object.freeze({
  CHARGER: "charger.management.queue",
  RESERVATION: "reservation.management.queue",
});

/**
 * A class containing available exchanges for this service.
 */
export const Exchanges = Object.freeze({
  CHARGER: "charger",
  RESERVATION: "reservation",
});

/**
 * A class containing operations available for each charger.
 */
export const RoutingKeys = Object.freeze({
  CHARGER_UPDATE: "charger.update",
  CHARGER_DELETE: "charger.delete",
  CHARGER_ADD: "charger.add",
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled",
});
