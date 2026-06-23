import mongoose from "mongoose";

const BilledReservationSchema = new mongoose.Schema(
  {
    reservationId:          { type: Number, required: true, unique: true },
    userId:                 { type: Number, required: true },
    chargerId:              { type: Number, required: true },
    locationName:           { type: String, default: "" },
    capacityKw:             { type: Number, default: 22 },
    providerName:           { type: String, required: true },
    kwhPrice:               { type: Number, default: 0 },
    originalDurationMinutes:{ type: Number, default: 0 },
    status:                 { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
    actualDurationSeconds:  { type: Number, default: null },
    totalCost:              { type: Number, default: null },
    createdAt:              { type: Date, required: true },
  },
  { timestamps: false },
);

BilledReservationSchema.index({ providerName: 1, createdAt: 1 });

const BilledReservation = mongoose.model("BilledReservation", BilledReservationSchema);

export default BilledReservation;
