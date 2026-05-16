import { MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import UserService from "../services/user.service.js";

export async function startUserQueueConsumer() {
  const channel = await getChannelWithRetry();

  await channel.assertQueue(MessageQueues.USER_PROFILE, {
    durable: true,
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
}
