import mongoose from "mongoose";
import { MONGOOSE_URL }
from "../config/env.js"

async function connectMongoDB() {
  await mongoose.connect(MONGOOSE_URL);
  console.log("Connected to auth DB");
}

export default connectMongoDB;