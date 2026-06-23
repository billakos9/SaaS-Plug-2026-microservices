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
  const channel = await getChannelWithRetry(10);

  await channel.assertQueue(MessageQueues.RESERVATION, {
    durable: true,
    arguments: { "x-dead-letter-exchange": DLX },
  });

  await channel.consume(MessageQueues.RESERVATION, async (message) => {
    if (!message) return;

    const plugClient = new PlugAdapterHttpClient();
    const routingKey = message.fields.routingKey;

    try {
      const saasPlugReservationRequest = JSON.parse(message.content.toString());
      switch (routingKey) {
        case RoutingKeys.RESERVATION_CREATED: {
          const { pointId, providerName, duration, locationName } = saasPlugReservationRequest;

          // Validate required fields before proceeding.
          // pointId must be a positive integer (charger ID).
          // providerName must be a non-empty string so we can look up the adapter URL.
          // duration must be a positive number (planned session minutes).
          if (
            typeof pointId !== "number" || !Number.isFinite(pointId) || pointId <= 0 ||
            typeof providerName !== "string" || providerName.trim() === "" ||
            typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0
          ) {
            console.warn(
              `[plug-service] Malformed reservation.created payload — nacking to DLX. ` +
              `pointId=${JSON.stringify(pointId)}, providerName=${JSON.stringify(providerName)}, ` +
              `duration=${JSON.stringify(duration)}`
            );
            channel.nack(message, false, false);
            break;
          }

          const adapterUrl = PROVIDER_BASE_URLS[providerName];
          if (!adapterUrl) {
            console.warn(`[plug-service] No adapter URL for provider: ${providerName}`);
            channel.nack(message, false, false);
            break;
          }

          await plugClient.reservePoint(adapterUrl, pointId, duration);
          channel.ack(message);
          break;
        }
        default:
          channel.ack(message);
          console.log("Unhandled event:", routingKey);
      }
    } catch (error) {
      console.error("Failed to process reservation event:", error.message);
      channel.nack(message, false, false);
    }
  });
}
