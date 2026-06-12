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
      default: 60,
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

const Reservation = mongoose.model("Reservation", ReservationSchema);

export default Reservation;
