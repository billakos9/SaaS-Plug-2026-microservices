import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";

const DLX = "saasplug.dlx";

let connection       = null;
let consumeChannel   = null;
let publishChannel   = null;
let channelPromise   = null;
let publishChPromise = null;

const reconnectHandlers = [];

export function onReconnect(fn) {
  reconnectHandlers.push(fn);
}

async function handleDisconnect(reason) {
  console.error(`[rabbitmq] connection lost (${reason}) — reconnecting...`);
  connection       = null;
  consumeChannel   = null;
  publishChannel   = null;
  channelPromise   = null;
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
  connection = await amqp.connect(RABBITMQ_URL, { clientProperties: { connection_name: "plug-service" } });
  connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
  connection.on("close", () => {
    channelPromise   = null;
    publishChPromise = null;
    handleDisconnect("connection closed");
  });
  return connection;
}

async function getChannel() {
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
  await channel.assertExchange(DLX, "fanout", { durable: true });

  await channel.assertQueue(MessageQueues.RESERVATION, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(MessageQueues.RESERVATION, Exchanges.RESERVATION, RoutingKeys.RESERVATION_CREATED);

  // Assert charger.management.queue and bind it before the first poll runs.
  // charger-service asserts the same queue with the same properties — idempotent.
  // Without this, messages published during cold boot (before charger-service has
  // bound the queue) are silently discarded by AMQP, causing the first provider
  // polled (bluePlug) to lose all its CHARGER_ADD events.
  await channel.assertQueue(MessageQueues.CHARGER, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(MessageQueues.CHARGER, Exchanges.CHARGER, "charger.*");
}

/**
 * Publishes an event to a RabbitMQ exchange using a routing key.
 *
 * Uses a dedicated publish channel separate from the consume channel to
 * avoid head-of-line blocking between publishing and consuming.
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
  const ch = await getPublishChannel();

  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
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
