import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";

let connection = null;
let channel    = null;

async function getChannel() {
  if (channel) return channel;
  connection = await amqp.connect(RABBITMQ_URL);
  channel    = await connection.createChannel();
  return channel;
}

async function getChannelWithRetry(retries = 5) {
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
  await ch.assertQueue(MessageQueues.ANALYTICS_RESERVATION, { durable: true });
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
    await handler(msg);
    ch.ack(msg);
  });

  console.log(`Analytics service consuming from ${MessageQueues.ANALYTICS_RESERVATION}`);
}
