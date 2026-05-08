import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";

/**
 * Registers consumers on the provider and charger queues for observability.
 * Admin-service is passive — it logs received events but does not mutate other services.
 *
 * @returns {Promise<void>} Resolves once both consumers are registered
 */
export async function startEventConsumers() {
  try {
    const channel = await getChannelWithRetry();

    await channel.assertQueue(MessageQueues.PROVIDER, { durable: true });
    await channel.consume(MessageQueues.PROVIDER, (message) => {
      if (!message) return;
      const routingKey = message.fields.routingKey;
      const data = JSON.parse(message.content.toString());

      switch (routingKey) {
        case RoutingKeys.PROVIDER_ADD:
          console.log(`[event] provider.add — providerId=${data.providerId} name=${data.providerName}`);
          break;
        case RoutingKeys.PROVIDER_UPDATE:
          console.log(`[event] provider.update — providerId=${data.providerId}`);
          break;
        case RoutingKeys.PROVIDER_DELETE:
          console.log(`[event] provider.delete — providerId=${data.providerId}`);
          break;
        default:
          console.log(`[event] unhandled provider event: ${routingKey}`);
      }

      channel.ack(message);
    });

    await channel.assertQueue(MessageQueues.CHARGER, { durable: true });
    await channel.consume(MessageQueues.CHARGER, (message) => {
      if (!message) return;
      const routingKey = message.fields.routingKey;
      const data = JSON.parse(message.content.toString());

      switch (routingKey) {
        case RoutingKeys.CHARGER_ADD:
          console.log(`[event] charger.add — chargerId=${data.id} provider=${data.ProviderName}`);
          break;
        case RoutingKeys.CHARGER_UPDATE:
          console.log(`[event] charger.update — chargerId=${data.id}`);
          break;
        case RoutingKeys.CHARGER_DELETE:
          console.log(`[event] charger.delete — chargerId=${data.id}`);
          break;
        default:
          console.log(`[event] unhandled charger event: ${routingKey}`);
      }

      channel.ack(message);
    });

    console.log("Admin event consumers started.");
  } catch (error) {
    console.error("Admin event consumer error:", error);
  }
}
