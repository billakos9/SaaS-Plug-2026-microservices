/**
 * A class containing all the available rabbitMQ message queues.
 */

/**
 * Αν χρειαστεί να καταναλώσει από το rabbit θα μπει και το παρακάτω export,
 * με τα αντίστοιχα δεδομένα
 * export const MessageQueues = Object.freeze({ });
*/


/**
 * A class containing available exchanges for this service.
 */
export const Exchanges = Object.freeze({
  USER: "user",
});

/**
 * A class containing operations available for each charger.
 */
export const RoutingKeys = Object.freeze({
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
});
