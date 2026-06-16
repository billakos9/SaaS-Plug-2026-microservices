import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";

const DLX = "saasplug.dlx";

let connection = null;
let channel = null;
let channelPromise = null;

const reconnectHandlers = [];

export function onReconnect(fn) {
  reconnectHandlers.push(fn);
}

async function handleDisconnect(reason) {
  console.error(`[rabbitmq] connection lost (${reason}) — reconnecting...`);
  connection = null;
  channel = null;
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

export async function getChannel() {
  if (channel) return channel;
  if (!channelPromise) {
    channelPromise = (async () => {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();

      connection.on("error", (err) => console.error("[rabbitmq] connection error:", err.message));
      connection.on("close", () => {
        channelPromise = null;
        handleDisconnect("connection closed");
      });

      return channel;
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
      retries -= 1;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error("RabbitMQ connection failed");
}

export async function setupMessaging() {
  const channel = await getChannelWithRetry();

  await channel.assertExchange(Exchanges.USER, "topic", {
    durable: true,
  });
  await channel.assertExchange(DLX, "fanout", { durable: true });

  await channel.assertQueue(MessageQueues.USER_PROFILE, {
    durable: true,
    arguments: { "x-dead-letter-exchange": DLX },
  });

  await channel.bindQueue(
    MessageQueues.USER_PROFILE,
    Exchanges.USER,
    RoutingKeys.USER_CREATED,
  );
}

export async function publishEvent(exchange, routingKey, payload) {
  const channel = await getChannelWithRetry();

  channel.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
    },
  );
}
