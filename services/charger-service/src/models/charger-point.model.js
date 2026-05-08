import mongoose from "mongoose";
import { ChargerStatus } from "../constants/charger-status.js";

const ChargerPointSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
    },
    ProviderName: {
      type: String,
      required: true,
    },
    longitude: String,
    latitude: String,
    location: {
      type: { type: String, enum: ["Point"] },
      coordinates: [Number],
    },
    status: {
      type: String,
      enum: Object.values(ChargerStatus),
      required: true,
    },
    cap: Number,
    kwhPrice: Number,
    address: String,
    locationName: String,
    connectionType: String,
  },
  { timestamps: true },
);

ChargerPointSchema.index({ location: "2dsphere" }, { sparse: true });

/**
 * Mongoose Model for ChargerPoint collection
 */
const ChargerPoint = mongoose.model("ChargerPoint", ChargerPointSchema);

export default ChargerPoint;
