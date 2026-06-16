import { Exchanges, MessageQueues, RoutingKeys } from "../constants/messaging.js";
import { getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import BilledReservationRepository from "../repositories/billed-reservation.repository.js";

const DLX = "saasplug.dlx";

export async function startBillingConsumers() {
  const channel = await getChannelWithRetry();

  await channel.assertExchange(Exchanges.RESERVATION, "topic", { durable: true });
  await channel.assertExchange(DLX, "fanout", { durable: true });
  await channel.assertQueue(MessageQueues.BILLING_RESERVATION, { durable: true, arguments: { "x-dead-letter-exchange": DLX } });
  await channel.bindQueue(MessageQueues.BILLING_RESERVATION, Exchanges.RESERVATION, RoutingKeys.RESERVATION_CREATED);
  await channel.bindQueue(MessageQueues.BILLING_RESERVATION, Exchanges.RESERVATION, RoutingKeys.RESERVATION_CANCELLED);
  await channel.bindQueue(MessageQueues.BILLING_RESERVATION, Exchanges.RESERVATION, RoutingKeys.RESERVATION_COMPLETED);

  await channel.consume(MessageQueues.BILLING_RESERVATION, async (msg) => {
    if (!msg) return;
    const routingKey = msg.fields.routingKey;
    try {
      const payload = JSON.parse(msg.content.toString());

      if (routingKey === RoutingKeys.RESERVATION_CREATED) {
        const { reservationId, userId, id, locationName, capacityKw, providerName, kwhPrice, duration } = payload;
        await BilledReservationRepository.create({
          reservationId,
          userId,
          chargerId: id,
          locationName: locationName || "",
          capacityKw: capacityKw ?? 22,
          providerName,
          kwhPrice: kwhPrice ?? 0,
          originalDurationMinutes: duration ?? 0,
          status: "active",
          createdAt: new Date(),
        });
      } else if (
        routingKey === RoutingKeys.RESERVATION_COMPLETED ||
        routingKey === RoutingKeys.RESERVATION_CANCELLED
      ) {
        const { reservationId, actualDuration, totalCost } = payload;
        const newStatus = routingKey === RoutingKeys.RESERVATION_COMPLETED ? "completed" : "cancelled";
        const updated = await BilledReservationRepository.updateOnFinalise(reservationId, {
          actualDurationSeconds: actualDuration,
          totalCost,
          status: newStatus,
        });
        if (!updated) {
          console.warn(`[billing-consumer] No BilledReservation found for reservationId=${reservationId} on ${routingKey} — snapshot may have been missed`);
        }
      }

      channel.ack(msg);
    } catch (err) {
      console.error(`[billing-consumer] Error handling ${routingKey}:`, err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log(`Billing consumers started on ${MessageQueues.BILLING_RESERVATION}`);
}
