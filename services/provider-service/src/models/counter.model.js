import mongoose from "mongoose";

/**
 * Mongoose schema for an auto-increment counter document.
 * Each counter is identified by a unique `name` (e.g. "providerId") and stores
 * the latest issued value so repository code can obtain monotonically increasing ids.
 */
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

/**
 * Mongoose Model for the Counter collection.
 */
const Counter = mongoose.model("Counter", CounterSchema);

export default Counter;
