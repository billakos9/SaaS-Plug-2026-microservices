import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AuthUserRepository from "../repositories/auth-user.repository.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";

const AUTH_UPDATE_QUEUE = "auth.user.update.queue";

export async function setupAuthConsumers() {
  const channel = await getChannelWithRetry();

  await channel.assertExchange(Exchanges.USER, "topic", { durable: true });
  await channel.assertQueue(AUTH_UPDATE_QUEUE, { durable: true });

  await channel.bindQueue(AUTH_UPDATE_QUEUE, Exchanges.USER, RoutingKeys.USER_UPDATED);

  channel.consume(AUTH_UPDATE_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      console.log("[Auth Service] Received user.updated event:", payload);

      const { userId, email } = payload;

      if (userId && email) {
        await AuthUserRepository.update(userId, { email: email.toLowerCase().trim() });
        console.log(`[Auth Service] Synchronized email for user ${userId}`);
      }

      channel.ack(msg);
    } catch (err) {
      console.error("[Auth Service] Error processing user.updated event:", err.message);
      // Negative acknowledgement - requeue if it's a transient error
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.USER_UPDATED} events...`);
}
