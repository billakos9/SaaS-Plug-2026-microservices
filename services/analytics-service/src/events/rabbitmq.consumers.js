import { startConsuming } from "../infrastructure/rabbitMQ.js";
import AnalyticStatRepository from "../repositories/analytic-stat.repository.js";

export async function startConsumers() {
  await startConsuming(async (msg) => {
    try {
      const routingKey = msg.fields.routingKey;
      const payload = JSON.parse(msg.content.toString());
      const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"

      if (routingKey === "reservation.created") {
        // Only increment the count of reservations
        await AnalyticStatRepository.upsertIncrement(payload.providerName, period, {
          totalReservations: 1,
        });
      } else if (routingKey === "reservation.completed" || routingKey === "reservation.cancelled") {
        // Add actual duration, energy, and revenue once finished
        const durationHrs = (payload.actualDuration || 0) / 60;
        const energyKwh = durationHrs * (payload.capacityKw || 22);

        await AnalyticStatRepository.upsertIncrement(payload.providerName, period, {
          totalDurationMinutes: payload.actualDuration || 0,
          totalEnergyKwh: energyKwh,
          totalRevenue: payload.totalCost || 0,
        });
      }
    } catch (err) {
      console.error("analytics consumer error:", err.message);
    }
  });
}
