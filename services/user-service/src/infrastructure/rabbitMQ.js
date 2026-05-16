import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";

let connection = null;
let channel = null;

export async function getChannel() {
  if (channel) return channel;

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  return channel;
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

  await channel.assertQueue(MessageQueues.USER_PROFILE, {
    durable: true,
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
