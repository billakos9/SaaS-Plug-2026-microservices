import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues } from "../constants/messaging.js";

const DLX = "saasplug.dlx";

let connection     = null;
let consumeChannel = null;
let publishChannel = null;
let channelPromise = null;
let publishChPromise = null;

const reconnectHandlers = [];

export function onReconnect(fn) {
  reconnectHandlers.push(fn);
}

async function handleDisconnect(reason) {
  console.error(`[rabbitmq] connection lost (${reason}) — reconnecting...`);
  connection     = null;
  consumeChannel = null;
  publishChannel = null;
  channelPromise = null;
  publishChPromise = null;

  while (true) {
    try {
      await getChannelWithRetry();
      for (const fn of reconnectHandlers) {
        await fn();
      }
      console.log("[rabbitmq] reconnected and resubscribed");
      return;
    } catch (err) {
      console.error("[rabbitmq] reconnect attempt failed, retrying in 5s:", err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function getConnection() {
  if (connection) return connection;
  connection = await amqp.connect(RABBITMQ_URL, { clientProperties: { connection_name: "admin-service" } });
  connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
  connection.on("close", () => {
    channelPromise   = null;
    publishChPromise = null;
    handleDisconnect("connection closed");
  });
  return connection;
}

/**
 * Returns the singleton RabbitMQ consume channel, creating the connection and channel
 * on first call. Subsequent calls return the cached channel instance.
 *
 * @returns {Promise<import("amqplib").Channel>} Active RabbitMQ channel
 */
export async function getChannel() {
  if (consumeChannel) return consumeChannel;
  if (!channelPromise) {
    channelPromise = (async () => {
      const conn = await getConnection();
      consumeChannel = await conn.createChannel();
      return consumeChannel;
    })().catch((err) => {
      channelPromise = null;
      throw err;
    });
  }
  return channelPromise;
}

async function getPublishChannel() {
  if (publishChannel) return publishChannel;
  if (!publishChPromise) {
    publishChPromise = (async () => {
      const conn = await getConnection();
      publishChannel = await conn.createChannel();
      return publishChannel;
    })().catch((err) => {
      publishChPromise = null;
      throw err;
    });
  }
  return publishChPromise;
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
 * Admin-service consumes observability/account events and publishes admin account lifecycle events.
 *
 * @returns {Promise<void>} Resolves once all exchanges and queues are asserted
 */
export async function setupMessaging() {
  const ch = await getChannelWithRetry();

  await ch.assertExchange(DLX, "fanout", { durable: true });

  await ch.assertExchange(Exchanges.PROVIDER, "topic", { durable: true });
  await ch.assertQueue(MessageQueues.PROVIDER, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await ch.bindQueue(MessageQueues.PROVIDER, Exchanges.PROVIDER, "provider.add");
  await ch.bindQueue(MessageQueues.PROVIDER, Exchanges.PROVIDER, "provider.update");
  await ch.bindQueue(MessageQueues.PROVIDER, Exchanges.PROVIDER, "provider.delete");

  await ch.assertExchange(Exchanges.CHARGER, "topic", { durable: true });
  await ch.assertQueue(MessageQueues.CHARGER, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await ch.bindQueue(MessageQueues.CHARGER, Exchanges.CHARGER, "charger.*");

  await ch.assertExchange(Exchanges.ADMIN, "topic", { durable: true });
}

/**
 * Publishes an event to a RabbitMQ exchange.
 *
 * @param {string} exchange - Exchange name
 * @param {string} routingKey - Event routing key
 * @param {Object} payload - JSON payload
 * @returns {Promise<void>}
 */
export async function publishEvent(exchange, routingKey, payload) {
  const ch = await getPublishChannel();
  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}
