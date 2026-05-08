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
  mongoose
    .connect(MONGOOSE_URL)
    .then(() => console.log("Connected to reservation DB"))
    .catch((err) => console.error(`Error connecting to reservation DB: ${err}`));

  await Reservation.syncIndexes();
}
