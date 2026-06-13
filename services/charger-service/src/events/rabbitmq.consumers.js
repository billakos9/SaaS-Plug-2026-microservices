import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import ChargerPointService from "../services/charger-point.service.js";

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
export async function startChargerQueueConsumer() {
  try {
    const channel = await getChannelWithRetry();

    await channel.assertQueue(MessageQueues.CHARGER, {
      durable: true,
    });

    await channel.consume(MessageQueues.CHARGER, async (message) => {
      if (!message) return;

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
    });

    await channel.consume(MessageQueues.RESERVATION, async (message) => {
      if (!message) return;

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
    });
  } catch (error) {
    console.log("Reservation Service Message Consumer Error:", error);
  }
}
