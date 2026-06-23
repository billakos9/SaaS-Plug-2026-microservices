import mongoose from "mongoose";

const ProcessedAnalyticEventSchema = new mongoose.Schema({
  reservationId: { type: String, required: true },
  eventType:     { type: String, required: true },
  processedAt:   { type: Date, default: Date.now },
});

ProcessedAnalyticEventSchema.index({ reservationId: 1, eventType: 1 }, { unique: true });
// 7-day TTL: safe redelivery window; keeps collection bounded in long-running deployments
ProcessedAnalyticEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 604800 });

const ProcessedAnalyticEvent = mongoose.model("ProcessedAnalyticEvent", ProcessedAnalyticEventSchema);

export default ProcessedAnalyticEvent;
