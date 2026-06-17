import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";

const DLX = "saasplug.dlx";

let connection     = null;
let consumeChannel = null;
let channelPromise = null;

const reconnectHandlers = [];

export function onReconnect(fn) {
  reconnectHandlers.push(fn);
}

async function handleDisconnect(reason) {
  console.error(`[rabbitmq] connection lost (${reason}) — reconnecting...`);
  connection     = null;
  consumeChannel = null;
  channelPromise = null;

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
  connection = await amqp.connect(RABBITMQ_URL);
  connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
  connection.on("close", () => {
    channelPromise = null;
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

export async function startConsuming(handler) {
  const ch = await getChannelWithRetry();

  await ch.assertExchange(Exchanges.RESERVATION, "topic", { durable: true });
  await ch.assertExchange(DLX, "fanout", { durable: true });
  await ch.assertQueue(MessageQueues.ANALYTICS_RESERVATION, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await ch.bindQueue(
    MessageQueues.ANALYTICS_RESERVATION,
    Exchanges.RESERVATION,
    RoutingKeys.RESERVATION_CREATED,
  );
  await ch.bindQueue(
    MessageQueues.ANALYTICS_RESERVATION,
    Exchanges.RESERVATION,
    RoutingKeys.RESERVATION_CANCELLED,
  );
  await ch.bindQueue(
    MessageQueues.ANALYTICS_RESERVATION,
    Exchanges.RESERVATION,
    RoutingKeys.RESERVATION_COMPLETED,
  );

  ch.consume(MessageQueues.ANALYTICS_RESERVATION, async (msg) => {
    if (!msg) return;
    try {
      await handler(msg);
      ch.ack(msg);
    } catch (err) {
      console.error("[analytics-consumer] Error processing message:", err.message);
      ch.nack(msg, false, false);
    }
  });

  console.log(`Analytics service consuming from ${MessageQueues.ANALYTICS_RESERVATION}`);
}
