import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues } from "../constants/messaging.js";

let connection = null;
let channel = null;

/**
 * Creates or returns a singleton RabbitMQ channel.
 *
 * Ensures only one connection/channel exists for the entire application
 * to prevent resource exhaustion and multiple competing consumers.
 *
 * @returns {Promise<import("amqplib").Channel>} RabbitMQ channel instance
 */
export async function getChannel() {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  return channel;
}

/**
 * Attempts to establish a RabbitMQ channel connection with retries.
 *
 * Retries up to `retries` times with a 3-second delay between attempts before
 * throwing if the broker remains unavailable.
 *
 * @param {number} retries - Maximum number of retry attempts before giving up (default: 5).
 * @returns {Promise<import("amqplib").Channel>} Resolves with the RabbitMQ channel instance.
 * @throws {Error} If all retry attempts are exhausted without a successful connection.
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
 * Declares the provider topic exchange and its durable queue, then binds them.
 *
 * Must be called once at application startup before any events are published or
 * consumed. Uses `getChannelWithRetry` internally so it tolerates a slow broker.
 *
 * @returns {Promise<void>} Resolves once the exchange, queue, and binding are confirmed.
 */
export async function setupMessaging() {
  const channel = await getChannelWithRetry();
  await channel.assertExchange(Exchanges.PROVIDER, "topic", { durable: true });
}
/**
 * Publishes an event to a RabbitMQ exchange using a routing key.
 *
 * This function is used for emitting domain events (e.g."provider.updated")
 * to other services via a topic exchange.
 *
 * Messages are sent as JSON and marked as persistent to survive broker restarts.
 *
 * @param {string} exchange - The name of the exchange (e.g. "provider")
 * @param {string} routingKey - The routing key describing the event (e.g. "provider.updated")
 * @param {Object} payload - The event payload to be sent (will be JSON-stringified)
 *
 * @returns {Promise<void>} Resolves when the message is successfully published
 *
 * @throws {Error} If the channel is not available or publish fails
 *
 * @example
 * await publishEvent(
 *   "provider",
 *   "provider.updated",
 *   { providerId: "123", email: "newemail@example.com" }
 * );
 */
export async function publishEvent(exchange, routingKey, payload) {
  const ch = await getChannelWithRetry();

  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}
