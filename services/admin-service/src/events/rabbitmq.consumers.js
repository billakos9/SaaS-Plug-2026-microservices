import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import AdminRepository from "../repositories/admin.repository.js";

const DLX = "saasplug.dlx";

/**
 * Registers consumers on the provider and charger queues for observability.
 * Admin-service is passive — it logs received events but does not mutate other services.
 *
 * @returns {Promise<void>} Resolves once both consumers are registered
 */
export async function startEventConsumers() {
  try {
    const channel = await getChannelWithRetry();

    await channel.assertExchange(DLX, "fanout", { durable: true });

    await channel.assertQueue(MessageQueues.PROVIDER, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
    await channel.consume(MessageQueues.PROVIDER, async (message) => {
      if (!message) return;
      try {
        const routingKey = message.fields.routingKey;
        const data = JSON.parse(message.content.toString());

        switch (routingKey) {
          case RoutingKeys.PROVIDER_ADD:
            console.log(`[event] provider.add — providerId=${data.providerId} name=${data.providerName}`);
            break;
          case RoutingKeys.PROVIDER_UPDATE:
            console.log(`[event] provider.update — providerId=${data.providerId}`);
            break;
          case RoutingKeys.PROVIDER_DELETE:
            console.log(`[event] provider.delete — providerId=${data.providerId}`);
            break;
          default:
            console.log(`[event] unhandled provider event: ${routingKey}`);
        }

        channel.ack(message);
      } catch (err) {
        console.error("[event] provider consumer error:", err.message);
        channel.nack(message, false, false);
      }
    });

    await channel.assertQueue(MessageQueues.CHARGER, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
    await channel.consume(MessageQueues.CHARGER, async (message) => {
      if (!message) return;
      try {
        const routingKey = message.fields.routingKey;
        const data = JSON.parse(message.content.toString());

        switch (routingKey) {
          case RoutingKeys.CHARGER_ADD:
            console.log(`[event] charger.add — chargerId=${data.id} provider=${data.ProviderName}`);
            break;
          case RoutingKeys.CHARGER_UPDATE:
            console.log(`[event] charger.update — chargerId=${data.id}`);
            break;
          case RoutingKeys.CHARGER_DELETE:
            console.log(`[event] charger.delete — chargerId=${data.id}`);
            break;
          default:
            console.log(`[event] unhandled charger event: ${routingKey}`);
        }

        channel.ack(message);
      } catch (err) {
        console.error("[event] charger consumer error:", err.message);
        channel.nack(message, false, false);
      }
    });

    await channel.assertQueue(MessageQueues.ADMIN_REGISTRATION, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
    await channel.bindQueue(MessageQueues.ADMIN_REGISTRATION, "admin", RoutingKeys.ADMIN_CREATED);
    await channel.consume(MessageQueues.ADMIN_REGISTRATION, async (message) => {
      if (!message) return;
      try {
        const { userId, email, firstName, lastName } = JSON.parse(message.content.toString());
        const existing = await AdminRepository.getByEmail(email);
        if (!existing) {
          const adminId = await AdminRepository.getNextId();
          await AdminRepository.create({
            adminId,
            firstName: firstName || "Admin",
            lastName: lastName || "User",
            email,
            password: null,
          });
          console.log(`[event] admin.created — created profile for ${email} (adminId=${adminId})`);
        }
        channel.ack(message);
      } catch (err) {
        console.error("[event] admin.created handler error:", err.message);
        channel.nack(message, false, false);
      }
    });

    console.log("Admin event consumers started.");
  } catch (error) {
    console.error("Admin event consumer error:", error);
  }
}
