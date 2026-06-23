import mongoose from "mongoose";

const outboxEventSchema = new mongoose.Schema({
  exchange:    { type: String, required: true },
  routingKey:  { type: String, required: true },
  payload:     { type: mongoose.Schema.Types.Mixed, required: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

outboxEventSchema.index({ publishedAt: 1, createdAt: 1 });

const OutboxEvent = mongoose.model("OutboxEvent", outboxEventSchema);
export default OutboxEvent;
