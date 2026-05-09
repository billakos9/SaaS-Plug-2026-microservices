import mongoose from "mongoose";
import { MONGOOSE_URL } from "../config/env.js";

async function connectMongoDB() {
  mongoose
    .connect(MONGOOSE_URL)
    .then(() => {
      console.log("Connected to user DB");
    })
    .catch((err) => {
      console.log(`Error connecting to user DB: ${err}`);
    });
}

export default connectMongoDB;
