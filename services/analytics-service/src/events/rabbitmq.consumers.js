import { startConsuming, getChannelWithRetry } from "../infrastructure/rabbitMQ.js";
import AnalyticStatRepository from "../repositories/analytic-stat.repository.js";
import { addRevoked } from "../lib/revoked-tokens.js";

const DLX = "saasplug.dlx";

export async function startConsumers() {
  const ch = await getChannelWithRetry();
  const TOKEN_REVOKED_QUEUE = "analytics.token.revoked.queue";
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

  await startConsuming(async (msg) => {
    const routingKey = msg.fields.routingKey;
    const payload = JSON.parse(msg.content.toString());
    // Use the reservation's own createdAt so stats are attributed to the correct month,
    // not the wall-clock time of queue delivery (which drifts on backlog/redelivery).
    const period = (payload.createdAt ? new Date(payload.createdAt) : new Date())
      .toISOString().slice(0, 7);

    if (routingKey === "reservation.created") {
      // Only increment the count of reservations
      await AnalyticStatRepository.upsertIncrement(payload.providerName, period, {
        totalReservations: 1,
      });
    } else if (routingKey === "reservation.completed" || routingKey === "reservation.cancelled") {
      // Add actual duration, energy, and revenue once finished
      const durationHrs = (payload.actualDuration || 0) / 3600;
      const energyKwh = durationHrs * (payload.capacityKw || 22);

      await AnalyticStatRepository.upsertIncrement(payload.providerName, period, {
        totalDurationMinutes: (payload.actualDuration || 0) / 60,
        totalEnergyKwh: energyKwh,
        totalRevenue: payload.totalCost || 0,
      });
    }
  });
}
