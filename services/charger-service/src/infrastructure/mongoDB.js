import mongoose from "mongoose";

import { MONGOOSE_URL } from "../config/env.js";
import ChargerPoint from "../models/charger-point.model.js";

async function connectMongoDB() {
  mongoose
    .connect(MONGOOSE_URL)
    .then(() => {
      console.log("Connected to charger DB");
    })
    .catch((err) => {
      console.log(`Error in connecting with charger DB: ${err}`);
    });

  await ChargerPoint.syncIndexes();
}

export default connectMongoDB;
