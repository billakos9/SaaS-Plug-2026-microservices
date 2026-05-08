import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues } from "../constants/messaging.js";

let connection = null;
let channel    = null;

/**
 * Returns a singleton RabbitMQ channel, creating the connection and channel on first call.
 *
 * Reuses the module-level `connection` and `channel` variables so that only one
 * channel exists for the lifetime of the process, preventing resource exhaustion.
 *
 * @returns {Promise<import("amqplib").Channel>} The shared RabbitMQ channel instance
 */
export async function getChannel() {
  if (channel) return channel;
  connection = await amqp.connect(RABBITMQ_URL);
  channel    = await connection.createChannel();
  return channel;
}

/**
 * Attempts to obtain a RabbitMQ channel, retrying on failure with a 3-second delay.
 *
 * Useful at startup when the broker may not yet be ready. Throws if all retries
 * are exhausted without a successful connection.
 *
 * @param {number} [retries=5] - Maximum number of connection attempts before giving up
 * @returns {Promise<import("amqplib").Channel>} The shared RabbitMQ channel instance
 * @throws {Error} If a channel cannot be obtained after all retries are exhausted
 */
export async function getChannelWithRetry(retries = 5) {
  while (retries) {
    try {
      return await getChannel();
    } catch (err) {
      console.log("RabbitMQ not ready, retrying...", err.message);
      retries--;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("RabbitMQ connection failed");
}

/**
 * Declares the reservation exchange and queue and binds them with a wildcard routing key.
 *
 * Must be called once at startup before any events are published. The exchange and
 * queue are declared as durable so they survive broker restarts.
 *
 * @returns {Promise<void>} Resolves when the exchange, queue, and binding are all asserted
 */
export async function setupMessaging() {
  const ch = await getChannelWithRetry();

  await ch.assertExchange(Exchanges.RESERVATION, "topic", { durable: true });
  await ch.assertQueue(MessageQueues.RESERVATION, { durable: true });
  await ch.bindQueue(MessageQueues.RESERVATION, Exchanges.RESERVATION, "reservation.*");
}

/**
 * Publishes a domain event to a RabbitMQ topic exchange.
 *
 * The payload is JSON-stringified and sent as a persistent message so it survives
 * broker restarts. Consumers bound to the exchange with a matching routing key
 * (e.g. "reservation.*") will receive the event.
 *
 * @param {string} exchange - Name of the target exchange (e.g. Exchanges.RESERVATION)
 * @param {string} routingKey - Routing key describing the event (e.g. "reservation.created")
 * @param {Object} payload - Event data to publish; will be JSON-stringified
 * @returns {Promise<void>} Resolves when the message has been handed to the broker
 * @throws {Error} If the channel is unavailable or the publish call fails
 */
export async function publishEvent(exchange, routingKey, payload) {
  const ch = await getChannelWithRetry();
  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}
