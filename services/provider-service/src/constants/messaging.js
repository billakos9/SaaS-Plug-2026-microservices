/**
 * A class containing all the available rabbitMQ message queues.
 */
export const MessageQueues = Object.freeze({
  PROVIDER: "provider.management.queue",
});

/**
 * A class containing available exchanges for this service.
 */
export const Exchanges = Object.freeze({
  PROVIDER: "provider",
});

/**
 * A class containing operations available for each provider.
 */
export const RoutingKeys = Object.freeze({
  PROVIDER_UPDATE: "provider.update",
  PROVIDER_DELETE: "provider.delete",
  PROVIDER_ADD: "provider.add",
});
