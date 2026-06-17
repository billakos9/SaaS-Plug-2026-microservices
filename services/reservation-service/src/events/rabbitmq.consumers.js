import { MessageQueues } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import ReservationService from "../services/reservation.service.js";
import { addRevoked } from "../lib/revoked-tokens.js";

const DLX = "saasplug.dlx";

export async function startTokenRevocationConsumer() {
  const channel = await getChannelWithRetry();
  const TOKEN_REVOKED_QUEUE = "reservation.token.revoked.queue";
  await channel.assertExchange("auth", "topic", { durable: true });
  await channel.assertQueue(TOKEN_REVOKED_QUEUE, {
    durable: true,
    arguments: { "x-dead-letter-exchange": DLX },
  });
  await channel.bindQueue(TOKEN_REVOKED_QUEUE, "auth", "token.revoked");
  channel.consume(TOKEN_REVOKED_QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const { email } = JSON.parse(msg.content.toString());
      if (email) addRevoked(email);
      channel.ack(msg);
    } catch (err) {
      console.error("[revocation] error:", err.message);
      channel.nack(msg, false, false);
    }
  });
}

export async function startUserDeleteConsumer() {
  const channel = await getChannelWithRetry();

  await channel.assertQueue(MessageQueues.USER_DELETE, {
    durable: true,
    arguments: { "x-dead-letter-exchange": DLX },
  });

  await channel.consume(MessageQueues.USER_DELETE, async (msg) => {
    if (!msg) return;

    try {
      const { userId } = JSON.parse(msg.content.toString());
      await ReservationService.cancelAllForUser(userId);
      channel.ack(msg);
    } catch (err) {
      console.error("[reservation-consumer] user.deleted handler error:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log("[reservation-service] user delete consumer started.");
}

export async function startEventConsumers() {
  await startTokenRevocationConsumer();
  await startUserDeleteConsumer();
}
