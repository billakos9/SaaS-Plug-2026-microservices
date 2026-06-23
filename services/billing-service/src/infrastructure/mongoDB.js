import mongoose from "mongoose";
import { MONGOOSE_URL } from "../config/env.js";
import BilledReservation from "../models/billed-reservation.model.js";
import Invoice from "../models/invoice.model.js";

export default async function connectMongoDB() {
  await mongoose.connect(MONGOOSE_URL);
  console.log("Connected to billing DB");
  await BilledReservation.syncIndexes();
  await Invoice.syncIndexes();
}
