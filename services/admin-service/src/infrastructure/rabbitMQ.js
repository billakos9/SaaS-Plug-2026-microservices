import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues } from "../constants/messaging.js";

let connection = null;
let channel = null;

/**
 * Returns the singleton RabbitMQ channel, creating the connection and channel
 * on first call. Subsequent calls return the cached channel instance.
 *
 * @returns {Promise<import("amqplib").Channel>} Active RabbitMQ channel
 */
export async function getChannel() {
  if (channel) return channel;
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  return channel;
}

/**
 * Attempts to obtain the RabbitMQ channel, retrying up to the specified number
 * of times with a 3-second delay between attempts.
 *
 * @param {number} [retries=5] - Maximum number of connection attempts
 * @returns {Promise<import("amqplib").Channel>} Active RabbitMQ channel
 * @throws {Error} If all retry attempts are exhausted
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
 * Declares the exchanges and queues this service subscribes to.
 * Admin-service is read-only on RabbitMQ — it only consumes, never publishes.
 *
 * @returns {Promise<void>} Resolves once all exchanges and queues are asserted
 */
export async function setupMessaging() {
  const ch = await getChannelWithRetry();

  await ch.assertExchange(Exchanges.PROVIDER, "topic", { durable: true });
  await ch.assertQueue(MessageQueues.PROVIDER, { durable: true });
  await ch.bindQueue(MessageQueues.PROVIDER, Exchanges.PROVIDER, "provider.*");

  await ch.assertExchange(Exchanges.CHARGER, "topic", { durable: true });
  await ch.assertQueue(MessageQueues.CHARGER, { durable: true });
  await ch.bindQueue(MessageQueues.CHARGER, Exchanges.CHARGER, "charger.*");
}
