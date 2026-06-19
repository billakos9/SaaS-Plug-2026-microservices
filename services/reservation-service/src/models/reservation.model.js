import mongoose from "mongoose";

const ReservationSchema = new mongoose.Schema(
  {
    reservationId: {
      type:     Number,
      required: true,
      unique:   true,
    },
    userId: {
      type:     Number,
      required: true,
    },
    chargerId: {
      type:     Number,
      required: true,
    },
    locationName: {
      type: String,
    },
    capacityKw: {
      type: Number,
      default: 22,
    },
    providerName: {
      type:     String,
      required: true,
    },
    duration: {
      type:    Number,
      default: 30,
    },
    actualDurationSeconds: {
      type:    Number,
      default: null,
    },
    kwhPrice: {
      type:    Number,
      default: 0,
    },
    status: {
      type:    String,
      enum:    ["active", "cancelled", "completed"],
      default: "active",
    },
  },
  { timestamps: true },
);

ReservationSchema.index({ userId: 1, status: 1 });
ReservationSchema.index({ status: 1, createdAt: 1 });
ReservationSchema.index({ providerName: 1, status: 1, createdAt: 1 });
// Prevents two concurrent active reservations for the same charger (DB-level race guard).
ReservationSchema.index(
  { chargerId: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "active_reservation_per_charger" },
);

const Reservation = mongoose.model("Reservation", ReservationSchema);

export default Reservation;
