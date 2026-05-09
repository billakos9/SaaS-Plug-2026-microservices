import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges } from "../constants/messaging.js";

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
      retries--;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("RabbitMQ connection failed");
}

export async function setupMessaging() {
  const ch = await getChannelWithRetry();
  await ch.assertExchange(Exchanges.CHARGER, "topic", { durable: true });
}

export async function publishEvent(exchange, routingKey, payload) {
  const ch = await getChannelWithRetry();
  ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });
}
