import mongoose from "mongoose";
import { ChargerStatus } from "../constants/charger-status.js";

const ChargerPointSchema = new mongoose.Schema({
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
}, { timestamps: true });

/**
 * Mongoose Model for ChargerPoint collection
 */
const ChargerPoint = mongoose.model("ChargerPoint", ChargerPointSchema);

export default ChargerPoint;
