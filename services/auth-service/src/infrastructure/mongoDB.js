import mongoose from "mongoose";
import { MONGOOSE_URL }
from "../config/env.js"

async function connectMongoDB() {
    mongoose
        .connect(MONGOOSE_URL)
        .then(() => {
            console.log("Connected to auth DB");
        })
        .catch((err) => {
            console.log(`Error in connecting with 
                auth DB: ${err}`);
        });
}

export default connectMongoDB;