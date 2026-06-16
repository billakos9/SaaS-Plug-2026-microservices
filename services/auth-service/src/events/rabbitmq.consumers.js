import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AuthUserRepository from "../repositories/auth-user.repository.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";

const DLX = "saasplug.dlx";

const AUTH_UPDATE_QUEUE = "auth.user.update.queue";
const AUTH_USER_DELETE_QUEUE = "auth.user.delete.queue";
const AUTH_PROVIDER_DELETE_QUEUE = "auth.provider.delete.queue";

export async function setupAuthConsumers() {
  const channel = await getChannelWithRetry();

  await channel.assertExchange(DLX, "fanout", { durable: true });

  // --- user.updated consumer ---
  await channel.assertExchange(Exchanges.USER, "topic", { durable: true });
  await channel.assertQueue(AUTH_UPDATE_QUEUE, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });

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
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.USER_UPDATED} events...`);

  // --- user.deleted consumer ---
  await channel.assertExchange(Exchanges.USER, "topic", { durable: true });
  await channel.assertQueue(AUTH_USER_DELETE_QUEUE, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(AUTH_USER_DELETE_QUEUE, Exchanges.USER, RoutingKeys.USER_DELETED);

  channel.consume(AUTH_USER_DELETE_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const { email } = payload;

      if (!email) {
        console.warn("[Auth Service] user.deleted event missing email — skipping auth cleanup");
        channel.ack(msg);
        return;
      }

      await AuthUserRepository.deleteByEmail(email);
      console.log(`[Auth Service] Deleted auth credentials for user with email ${email}`);
      channel.ack(msg);
    } catch (err) {
      console.error("[Auth Service] Error processing user.deleted event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.USER_DELETED} events...`);

  // --- provider.delete consumer ---
  await channel.assertExchange(Exchanges.PROVIDER, "topic", { durable: true });
  await channel.assertQueue(AUTH_PROVIDER_DELETE_QUEUE, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(AUTH_PROVIDER_DELETE_QUEUE, Exchanges.PROVIDER, RoutingKeys.PROVIDER_DELETE);

  channel.consume(AUTH_PROVIDER_DELETE_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const { email } = payload;

      if (!email) {
        console.warn("[Auth Service] provider.delete event missing email — skipping auth cleanup");
        channel.ack(msg);
        return;
      }

      await AuthUserRepository.deleteByEmail(email);
      console.log(`[Auth Service] Deleted auth credentials for provider with email ${email}`);
      channel.ack(msg);
    } catch (err) {
      console.error("[Auth Service] Error processing provider.delete event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.PROVIDER_DELETE} events...`);
}
