import mongoose from "mongoose";
import { MONGOOSE_URL } from "../config/env.js";
import Admin from "../models/admin.model.js";

/**
 * Connects to MongoDB using the configured MONGOOSE_URL and synchronises
 * model indexes. Logs connection success or failure to the console.
 * Should be called once at application startup.
 *
 * @returns {Promise<void>} Resolves after the connection attempt and index sync
 */
export default async function connectMongoDB() {
  mongoose
    .connect(MONGOOSE_URL)
    .then(() => console.log("Connected to admin DB"))
    .catch((err) => console.error(`Error connecting to admin DB: ${err}`));

  await Admin.syncIndexes();
}
