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
    providerName: {
      type:     String,
      required: true,
    },
    duration: {
      type:    Number,
      default: 60,
    },
    status: {
      type:    String,
      enum:    ["active", "cancelled"],
      default: "active",
    },
  },
  { timestamps: true },
);

const Reservation = mongoose.model("Reservation", ReservationSchema);

export default Reservation;
