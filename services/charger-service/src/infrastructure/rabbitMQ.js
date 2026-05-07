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
 *  A function that attempts to establish a RabbitMQ channel connection with retries.
 * @param {Number} retries - The number of retry attempts before giving up (default: 5)
 *
 * @returns {Promise<import("amqplib").Channel>} RabbitMQ channel instance
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
 * A function responsible for setting up RabbitMQ message MessageQueues.
 *
 */
export async function setupMessaging() {
  const channel = await getChannelWithRetry();

  await channel.assertExchange(Exchanges.CHARGER, "topic", { durable: true });
  await channel.assertExchange(Exchanges.RESERVATION, "topic", {
    durable: true,
  });

  await channel.assertQueue(MessageQueues.CHARGER, {
    durable: true,
  });
  await channel.bindQueue(
    MessageQueues.CHARGER,
    Exchanges.RESERVATION,
    "reservation.*",
  );

  await channel.assertQueue(MessageQueues.RESERVATION, {
    durable: true,
  });
  await channel.bindQueue(
    MessageQueues.RESERVATION,
    Exchanges.RESERVATION,
    "reservation.*",
  );
}
/**
 * Publishes an event to a RabbitMQ exchange using a routing key.
 *
 * This function is used for emitting domain events (e.g. "reservation.created",
 * "charger.status.updated") to other services via a topic exchange.
 *
 * Messages are sent as JSON and marked as persistent to survive broker restarts.
 *
 * @param {string} exchange - The name of the exchange (e.g. "charger", "reservation")
 * @param {string} routingKey - The routing key describing the event (e.g. "charger.status.updated")
 * @param {Object} payload - The event payload to be sent (will be JSON-stringified)
 *
 * @returns {Promise<void>} Resolves when the message is successfully published
 *
 * @throws {Error} If the channel is not available or publish fails
 *
 * @example
 * await publishEvent(
 *   "charger",
 *   "charger.status.updated",
 *   { chargerId: "123", status: "busy" }
 * );
 */
export async function publishEvent(exchange, routingKey, payload) {
  const ch = await getChannelWithRetry();

  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}
