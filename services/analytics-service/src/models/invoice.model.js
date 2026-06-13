import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceId:        { type: Number, required: true, unique: true },
    providerName:     { type: String, required: true },
    period:           { type: String, required: true },
    totalSessions:    { type: Number, required: true },
    totalRevenue:     { type: Number, required: true },
    commissionRate:   { type: Number, default: 0.10 },
    commissionAmount: { type: Number, required: true },
    feePerSession:    { type: Number, default: 0.30 },
    sessionFee:       { type: Number, required: true },
    totalDue:         { type: Number, required: true },
    status:           { type: String, enum: ["pending", "paid"], default: "pending" },
    generatedAt:      { type: Date, default: Date.now },
  },
  { timestamps: true },
);

InvoiceSchema.index({ providerName: 1, period: 1 }, { unique: true });

const Invoice = mongoose.model("Invoice", InvoiceSchema);

export default Invoice;
