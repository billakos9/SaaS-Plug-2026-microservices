import mongoose from "mongoose";
import { MONGOOSE_URL } from "../config/env.js";
import Reservation from "../models/reservation.model.js";

/**
 * Connects to MongoDB using Mongoose and syncs reservation model indexes.
 *
 * Called once at application startup. Mongoose internally manages a singleton
 * connection pool, so subsequent calls to this function will reuse the existing
 * connection. Index sync ensures unique constraints on reservationId are applied
 * before the service starts accepting requests.
 *
 * @returns {Promise<void>} Resolves when the connection attempt and index sync are complete
 */
export default async function connectMongoDB() {
  await mongoose.connect(MONGOOSE_URL);
  console.log("Connected to reservation DB");

  await repairDuplicateActiveReservations();
  await Reservation.syncIndexes();
}

async function repairDuplicateActiveReservations() {
  const duplicates = await Reservation.aggregate([
    { $match: { status: "active" } },
    { $sort: { createdAt: 1, reservationId: 1 } },
    {
      $group: {
        _id: "$chargerId",
        count: { $sum: 1 },
        reservationIds: { $push: "$reservationId" },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  for (const duplicate of duplicates) {
    const [, ...reservationIdsToCancel] = duplicate.reservationIds;
    if (!reservationIdsToCancel.length) continue;

    await Reservation.updateMany(
      { reservationId: { $in: reservationIdsToCancel }, status: "active" },
      { $set: { status: "cancelled", updatedAt: new Date() } },
    );

    console.warn(
      `[reservation-service] Cancelled duplicate active reservations for charger ${duplicate._id}: ${reservationIdsToCancel.join(", ")}`,
    );
  }
}
