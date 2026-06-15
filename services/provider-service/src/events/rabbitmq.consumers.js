import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";
import ProviderService from "../services/provider.service.js";

export async function startProviderQueueConsumer() {
  const ch = await getChannelWithRetry();

  await ch.assertQueue(MessageQueues.PROVIDER_REGISTRATION, { durable: true });
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
