import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { PlugAdapterHttpClient } from "../http-client.js";
import { PROVIDER_BASE_URLS } from "../constants/provider-base-url.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";

const DLX = "saasplug.dlx";

/**
 * Starts a RabbitMQ consumer for the Plug Service.
 *
 * This function listens to a predefined queue and processes incoming events
 * based on their routing keys. It is designed to run continuously as part of
 * the service lifecycle.
 *
 * The consumer:
 * - Parses incoming messages as JSON
 * - Routes them based on the routing key
 * - Acknowledges messages after successful processing
 *
 * @returns {Promise<void>} Resolves once the consumer is successfully started
 *
 * @throws {Error} If connection or queue consumption fails
 *
 * @remarks
 * - This function should be called once during service startup
 * - Ensure `setupMessaging()` has been executed before calling this
 * - Messages are acknowledged manually to ensure reliability
 */
export async function startChargerQueueConsumer() {
  try {
    const channel = await getChannelWithRetry(10);

    await channel.assertQueue(MessageQueues.RESERVATION, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX },
    });

    await channel.consume(MessageQueues.RESERVATION, async (message) => {
      if (!message) return;

      const plugClient = new PlugAdapterHttpClient();
      const routingKey = message.fields.routingKey;
      const saasPlugReservationRequest = JSON.parse(message.content.toString());

      try {
        switch (routingKey) {
          case RoutingKeys.RESERVATION_CREATED: {
            const adapterUrl = PROVIDER_BASE_URLS[saasPlugReservationRequest.providerName];
            if (!adapterUrl) {
              console.warn(`No adapter URL for provider: ${saasPlugReservationRequest.providerName}`);
              channel.nack(message, false, false);
              break;
            }
            await plugClient.reservePoint(
              adapterUrl,
              saasPlugReservationRequest.pointId,
              saasPlugReservationRequest.duration,
            );
            channel.ack(message);
            break;
          }
          default:
            channel.nack(message, false, false);
            console.log("Unhandled event:", routingKey);
        }
      } catch (error) {
        console.error("Failed to process reservation event:", error.message);
        channel.nack(message, false, false);
      }
    });
  } catch (error) {
    console.log("Plug Service Message Consumer Error:", error);
  }
}
