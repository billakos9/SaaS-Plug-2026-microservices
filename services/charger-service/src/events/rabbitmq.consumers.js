import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import ChargerPointService from "../services/charger-point.service.js";
import { addRevoked } from "../lib/revoked-tokens.js";

const DLX = "saasplug.dlx";

/**
 * Starts a RabbitMQ consumer for the Charger Service.
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
export async function startTokenRevocationConsumer() {
  try {
    const channel = await getChannelWithRetry();
    const TOKEN_REVOKED_QUEUE = "charger.token.revoked.queue";
    await channel.assertExchange("auth", "topic", { durable: true });
    await channel.assertQueue(TOKEN_REVOKED_QUEUE, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX },
    });
    await channel.bindQueue(TOKEN_REVOKED_QUEUE, "auth", "token.revoked");
    await channel.consume(TOKEN_REVOKED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const { email } = JSON.parse(msg.content.toString());
        if (email) addRevoked(email);
        channel.ack(msg);
      } catch (err) {
        console.error("[revocation] error:", err.message);
        channel.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.log("Token revocation consumer error:", error);
  }
}

export async function startChargerQueueConsumer() {
  try {
    const channel = await getChannelWithRetry();

    await channel.assertQueue(MessageQueues.CHARGER, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX },
    });

    await channel.consume(MessageQueues.CHARGER, async (message) => {
      if (!message) return;

      try {
        const routingKey = message.fields.routingKey;
        const chargerData = JSON.parse(message.content.toString());

        switch (routingKey) {
          case RoutingKeys.CHARGER_ADD:
            await ChargerPointService.create(chargerData);
            break;
          case RoutingKeys.CHARGER_DELETE:
            await ChargerPointService.delete(chargerData.id);
            break;
          case RoutingKeys.CHARGER_UPDATE:
            await ChargerPointService.update(chargerData);
            break;
          default:
            console.log("Unhandled event:", routingKey);
        }

        channel.ack(message);
      } catch (error) {
        console.error("[charger-consumer] Error processing message:", error.message);
        channel.nack(message, false, false);
      }
    });
  } catch (error) {
    console.log("Charger Service Message Consumer Error:", error);
  }
}

/**
 * Starts a RabbitMQ consumer for the Reservation Service.
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
export async function startReservationQueueConsumer() {
  try {
    const channel = await getChannelWithRetry();

    await channel.assertQueue(MessageQueues.RESERVATION, {
      durable: true,
      arguments: { "x-dead-letter-exchange": DLX },
    });

    await channel.consume(MessageQueues.RESERVATION, async (message) => {
      if (!message) return;

      try {
        const routingKey = message.fields.routingKey;
        const reservationData = JSON.parse(message.content.toString());

        try {
          switch (routingKey) {
            case RoutingKeys.RESERVATION_CREATED:
              await ChargerPointService.update({ id: reservationData.id, status: "reserved" }, true);
              break;
            case RoutingKeys.RESERVATION_COMPLETED:
              await ChargerPointService.update({ id: reservationData.id, status: "available" }, true);
              break;
            case RoutingKeys.RESERVATION_CANCELLED:
              // Do not reset to available — external provider still holds the slot.
              // Plug-service polling will flip status back when the external API releases it.
              break;
            default:
              console.log("Unhandled reservation event:", routingKey);
          }
        } catch (error) {
          if (error.statusCode === 404) {
            console.warn(`Reservation event ignored: Charger ${reservationData.id} not found.`);
          } else {
            throw error;
          }
        }

        channel.ack(message);
      } catch (error) {
        console.error("[reservation-consumer] Error processing message:", error.message);
        channel.nack(message, false, false);
      }
    });
  } catch (error) {
    console.log("Reservation Service Message Consumer Error:", error);
  }
}
