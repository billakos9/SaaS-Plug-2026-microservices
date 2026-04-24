import amqp from "amqplib";
import { RABBITMQ_URL } from "../config/env.js";

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
 * Sends a message to the "task_queue".
 *
 * Ensures queue exists before publishing.
 *
 * @param {string} message - Message to send to RabbitMQ queue
 * @returns {Promise<void>}
 */
export async function sendMessage(message) {
  const ch = await getChannel();
  const queue = "task_queue";

  await ch.assertQueue(queue, { durable: false });
  ch.sendToQueue(queue, Buffer.from(message));
}

/**
 * Starts a long-running consumer for "task_queue".
 *
 * This function is meant to run once in a dedicated worker process.
 * It listens continuously for incoming messages.
 *
 * @returns {Promise<void>}
 */
export async function startConsumer() {
  const ch = await getChannel();
  const queue = "task_queue";

  await ch.assertQueue(queue, { durable: false });

  ch.consume(
    queue,
    (msg) => {
      if (!msg) return;
      console.log(msg.content.toString());
    },
    { noAck: true },
  );
}
