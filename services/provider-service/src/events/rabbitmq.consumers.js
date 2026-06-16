import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";
import ProviderService from "../services/provider.service.js";
import { addRevoked } from "../lib/revoked-tokens.js";

const DLX = "saasplug.dlx";

export async function startTokenRevocationConsumer() {
  const ch = await getChannelWithRetry();
  const TOKEN_REVOKED_QUEUE = "provider.token.revoked.queue";
  await ch.assertExchange("auth", "topic", { durable: true });
  await ch.assertQueue(TOKEN_REVOKED_QUEUE, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await ch.bindQueue(TOKEN_REVOKED_QUEUE, "auth", "token.revoked");
  ch.consume(TOKEN_REVOKED_QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const { email } = JSON.parse(msg.content.toString());
      if (email) addRevoked(email);
      ch.ack(msg);
    } catch (err) {
      console.error("[revocation] error:", err.message);
      ch.nack(msg, false, false);
    }
  });
}

export async function startProviderQueueConsumer() {
  const ch = await getChannelWithRetry();

  await ch.assertExchange(DLX, "fanout", { durable: true });
  await ch.assertQueue(MessageQueues.PROVIDER_REGISTRATION, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await ch.bindQueue(MessageQueues.PROVIDER_REGISTRATION, Exchanges.PROVIDER, RoutingKeys.PROVIDER_REGISTERED);

  ch.consume(MessageQueues.PROVIDER_REGISTRATION, async (msg) => {
    if (!msg) return;
    try {
      const { providerName, email, apiBaseUrl, apiKey } = JSON.parse(msg.content.toString());
      await ProviderService.registerProvider({ providerName, email, apiBaseUrl, apiKey });
      ch.ack(msg);
    } catch (err) {
      console.error("[provider consumer] provider.registered error:", err.message);
      ch.nack(msg, false, false);
    }
  });
}
