import mongoose from "mongoose";

import { MONGOOSE_URL } from "../config/env.js";
import Provider from "../models/provider.model.js";

/**
 * Establishes a connection to the MongoDB database and synchronises model indexes.
 *
 * Uses the MONGOOSE_URL environment variable as the connection string.
 * Connection errors are logged to the console without throwing so the process
 * continues; index synchronisation runs once after the connect call resolves.
 *
 * @returns {Promise<void>} Resolves after the connection attempt and index sync.
 */
async function connectMongoDB() {
  mongoose
    .connect(MONGOOSE_URL)
    .then(() => {
      console.log("Connected to provider DB");
    })
    .catch((err) => {
      console.log(`Error in connecting with provider DB: ${err}`);
    });

  await Provider.syncIndexes();
}

export default connectMongoDB;
