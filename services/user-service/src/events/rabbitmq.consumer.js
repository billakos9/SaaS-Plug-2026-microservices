import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import UserService from "../services/user.service.js";
import { addRevoked } from "../lib/revoked-tokens.js";

const DLX = "saasplug.dlx";

export async function startUserQueueConsumer() {
  const channel = await getChannelWithRetry();

  await channel.assertQueue(MessageQueues.USER_PROFILE, {
    durable: true,
    arguments: { "x-dead-letter-exchange": DLX },
  });

  await channel.consume(MessageQueues.USER_PROFILE, async (message) => {
    if (!message) return;

    try {
      const routingKey = message.fields.routingKey;
      const userData = JSON.parse(message.content.toString());

      switch (routingKey) {
        case RoutingKeys.USER_CREATED:
          await UserService.syncCreatedUser(userData);
          break;
        default:
          console.log("Unhandled user event:", routingKey);
      }

      channel.ack(message);
    } catch (error) {
      console.error("User event consumer error:", error.message);
      channel.nack(message, false, false);
    }
  });

  console.log("User event consumer started.");

  const TOKEN_REVOKED_QUEUE = "user.token.revoked.queue";
  await channel.assertExchange("auth", "topic", { durable: true });
  await channel.assertQueue(TOKEN_REVOKED_QUEUE, {
    durable: true,
    arguments: { "x-dead-letter-exchange": DLX },
  });
  await channel.bindQueue(TOKEN_REVOKED_QUEUE, "auth", "token.revoked");
  await channel.consume(TOKEN_REVOKED_QUEUE, async (msg) => {
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
