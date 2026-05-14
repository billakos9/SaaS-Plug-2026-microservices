import mongoose from "mongoose";

const AnalyticStatSchema = new mongoose.Schema(
  {
    providerName:         { type: String, required: true },
    period:               { type: String, required: true }, // "YYYY-MM"
    totalReservations:    { type: Number, default: 0 },
    totalDurationMinutes: { type: Number, default: 0 },
    totalRevenue:         { type: Number, default: 0 },
  },
  { timestamps: true },
);

AnalyticStatSchema.index({ providerName: 1, period: 1 }, { unique: true });

const AnalyticStat = mongoose.model("AnalyticStat", AnalyticStatSchema);

export default AnalyticStat;
