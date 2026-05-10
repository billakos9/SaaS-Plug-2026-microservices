import mongoose from "mongoose";
import { MONGOOSE_URL } from "../config/env.js";
import AnalyticStat from "../models/analytic-stat.model.js";

export default async function connectMongoDB() {
  mongoose
    .connect(MONGOOSE_URL)
    .then(() => console.log("Connected to analytics DB"))
    .catch((err) => console.error(`Error connecting to analytics DB: ${err}`));

  await AnalyticStat.syncIndexes();
}
