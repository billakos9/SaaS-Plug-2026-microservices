import BilledReservation from "../models/billed-reservation.model.js";

function periodBounds(period) {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);
  return { start, end };
}

class BilledReservationRepository {
  static async create(data) {
    return BilledReservation.create(data);
  }

  static async upsertOnCreate(data) {
    return BilledReservation.findOneAndUpdate(
      { reservationId: data.reservationId },
      { $setOnInsert: data },
      { upsert: true, returnDocument: "after" },
    ).lean();
  }

  static async upsertOnFinalise(reservationId, setFields, setOnInsertFields) {
    return BilledReservation.findOneAndUpdate(
      { reservationId },
      { $set: setFields, $setOnInsert: setOnInsertFields },
      { upsert: true, returnDocument: "after" },
    ).lean();
  }

  static async getForPeriod(providerName, period) {
    const { start, end } = periodBounds(period);
    return BilledReservation.find({
      providerName,
      status: { $in: ["completed", "cancelled"] },
      createdAt: { $gte: start, $lt: end },
    }).sort({ createdAt: 1 }).lean();
  }

  static async aggregateForPeriod(providerName, period) {
    const { start, end } = periodBounds(period);
    const result = await BilledReservation.aggregate([
      {
        $match: {
          providerName,
          status: { $in: ["completed", "cancelled"] },
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalRevenue:  { $sum: { $ifNull: ["$totalCost", 0] } },
        },
      },
    ]);
    if (!result.length) return null;
    return { totalSessions: result[0].totalSessions, totalRevenue: result[0].totalRevenue };
  }

  static async distinctProvidersForPeriod(period) {
    const { start, end } = periodBounds(period);
    return BilledReservation.distinct("providerName", {
      status: { $in: ["completed", "cancelled"] },
      createdAt: { $gte: start, $lt: end },
    });
  }
}

export default BilledReservationRepository;
