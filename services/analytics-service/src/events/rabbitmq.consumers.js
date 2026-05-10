import { startConsuming } from "../infrastructure/rabbitMQ.js";
import AnalyticStatRepository from "../repositories/analytic-stat.repository.js";

export async function startConsumers() {
  await startConsuming(async (msg) => {
    try {
      const payload = JSON.parse(msg.content.toString());
      // payload: { reservationId, userId, id, pointId, providerName, duration, kwhPrice, status }
      const period  = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      const revenue = (payload.duration / 60) * (payload.kwhPrice ?? 0);

      await AnalyticStatRepository.upsertIncrement(payload.providerName, period, {
        totalReservations:    1,
        totalDurationMinutes: payload.duration,
        totalRevenue:         revenue,
      });
    } catch (err) {
      console.error("analytics consumer error:", err.message);
    }
  });
}
