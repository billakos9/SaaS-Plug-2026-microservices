import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import AuthUserRepository from "../repositories/auth-user.repository.js";
import { getChannelWithRetry, publishEvent } from "../infrastructure/rabbitMQ.js";
import { addRevoked } from "../lib/revoked-tokens.js";

const DLX = "saasplug.dlx";

const AUTH_UPDATE_QUEUE = "auth.user.update.queue";
const AUTH_USER_DELETE_QUEUE = "auth.user.delete.queue";
const AUTH_PROVIDER_DELETE_QUEUE = "auth.provider.delete.queue";
const AUTH_ADMIN_UPDATE_QUEUE = "auth.admin.update.queue";
const AUTH_ADMIN_DELETE_QUEUE = "auth.admin.delete.queue";

export async function setupAuthConsumers() {
  const channel = await getChannelWithRetry();

  await channel.assertExchange(DLX, "fanout", { durable: true });
  await channel.assertExchange(Exchanges.AUTH, "topic", { durable: true });

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
      addRevoked(email);
      await publishEvent(Exchanges.AUTH, RoutingKeys.TOKEN_REVOKED, { email });
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
      addRevoked(email);
      await publishEvent(Exchanges.AUTH, RoutingKeys.TOKEN_REVOKED, { email });
      console.log(`[Auth Service] Deleted auth credentials for provider with email ${email}`);
      channel.ack(msg);
    } catch (err) {
      console.error("[Auth Service] Error processing provider.delete event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.PROVIDER_DELETE} events...`);

  // --- admin.updated consumer ---
  await channel.assertExchange(Exchanges.ADMIN, "topic", { durable: true });
  await channel.assertQueue(AUTH_ADMIN_UPDATE_QUEUE, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(AUTH_ADMIN_UPDATE_QUEUE, Exchanges.ADMIN, RoutingKeys.ADMIN_UPDATED);

  channel.consume(AUTH_ADMIN_UPDATE_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const { oldEmail, email, passwordHash } = payload;

      if (!oldEmail || !email) {
        console.warn("[Auth Service] admin.updated event missing email fields — skipping auth sync");
        channel.ack(msg);
        return;
      }

      const normalizedOldEmail = oldEmail.toLowerCase().trim();
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await AuthUserRepository.findByEmail(normalizedOldEmail);

      if (!existing) {
        console.warn(`[Auth Service] No admin auth credentials found for email ${normalizedOldEmail} — skipping auth sync`);
        channel.ack(msg);
        return;
      }

      if (existing.role !== "admin") {
        console.warn(`[Auth Service] admin.updated email ${normalizedOldEmail} belongs to role ${existing.role} — skipping auth sync`);
        channel.ack(msg);
        return;
      }

      if (normalizedEmail !== normalizedOldEmail) {
        const emailOwner = await AuthUserRepository.findByEmail(normalizedEmail);
        if (emailOwner) {
          throw new Error(`Cannot sync admin email update: ${normalizedEmail} already exists in auth-db`);
        }
      }

      const updateData = {};
      if (normalizedEmail !== normalizedOldEmail) updateData.email = normalizedEmail;
      if (passwordHash) updateData.passwordHash = passwordHash;

      if (Object.keys(updateData).length === 0) {
        console.log(`[Auth Service] admin.updated for ${normalizedOldEmail} did not change auth fields`);
        channel.ack(msg);
        return;
      }

      await AuthUserRepository.updateByEmailAndRole(normalizedOldEmail, "admin", updateData);

      addRevoked(normalizedOldEmail);
      await publishEvent(Exchanges.AUTH, RoutingKeys.TOKEN_REVOKED, { email: normalizedOldEmail });

      if (normalizedEmail !== normalizedOldEmail) {
        addRevoked(normalizedEmail);
        await publishEvent(Exchanges.AUTH, RoutingKeys.TOKEN_REVOKED, { email: normalizedEmail });
      }

      console.log(`[Auth Service] Synchronized admin auth credentials for ${normalizedOldEmail}`);
      channel.ack(msg);
    } catch (err) {
      console.error("[Auth Service] Error processing admin.updated event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.ADMIN_UPDATED} events...`);

  // --- admin.deleted consumer ---
  await channel.assertExchange(Exchanges.ADMIN, "topic", { durable: true });
  await channel.assertQueue(AUTH_ADMIN_DELETE_QUEUE, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(AUTH_ADMIN_DELETE_QUEUE, Exchanges.ADMIN, RoutingKeys.ADMIN_DELETED);

  channel.consume(AUTH_ADMIN_DELETE_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const payload = JSON.parse(msg.content.toString());
      const { email } = payload;

      if (!email) {
        console.warn("[Auth Service] admin.deleted event missing email — skipping auth cleanup");
        channel.ack(msg);
        return;
      }

      const existing = await AuthUserRepository.findByEmail(email);

      if (existing && existing.role !== "admin") {
        console.warn(`[Auth Service] admin.deleted email ${email} belongs to role ${existing.role} — skipping auth cleanup`);
        channel.ack(msg);
        return;
      }

      const deleted = existing
        ? await AuthUserRepository.deleteByEmailAndRole(email, "admin")
        : null;

      if (!deleted) {
        console.warn(`[Auth Service] No admin auth credentials found for email ${email}; revoking any existing tokens`);
      }

      addRevoked(email);
      await publishEvent(Exchanges.AUTH, RoutingKeys.TOKEN_REVOKED, { email });
      console.log(`[Auth Service] Revoked admin auth for email ${email}`);
      channel.ack(msg);
    } catch (err) {
      console.error("[Auth Service] Error processing admin.deleted event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(`[Auth Service] Listening for ${RoutingKeys.ADMIN_DELETED} events...`);
}
