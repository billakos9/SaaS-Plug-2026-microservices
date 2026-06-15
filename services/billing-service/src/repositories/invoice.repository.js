import Invoice from "../models/invoice.model.js";
import Counter from "../models/counter.model.js";

class InvoiceRepository {
  static async getNextId() {
    const counter = await Counter.findByIdAndUpdate(
      "invoiceId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return counter.seq;
  }

  static async create(data) {
    return Invoice.create(data);
  }

  static async findByProviderName(providerName) {
    return Invoice.find({ providerName }).sort({ period: -1 }).lean();
  }

  static async findAll() {
    return Invoice.find().sort({ generatedAt: -1 }).lean();
  }

  static async findById(invoiceId) {
    return Invoice.findOne({ invoiceId }).lean();
  }

  static async markPaid(invoiceId) {
    return Invoice.findOneAndUpdate(
      { invoiceId },
      { $set: { status: "paid" } },
      { new: true },
    ).lean();
  }
}

export default InvoiceRepository;
