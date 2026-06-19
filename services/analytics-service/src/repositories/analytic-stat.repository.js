import AnalyticStat from "../models/analytic-stat.model.js";

class AnalyticStatRepository {
  static async getByProviderAndPeriod(providerName, period) {
    return AnalyticStat.findOne({ providerName, period }).lean();
  }

  static async getAllByPeriod(period) {
    return AnalyticStat.find({ period }).lean();
  }

  static async getAllByProvider(providerName) {
    return AnalyticStat.find({ providerName }).sort({ period: 1 }).limit(1000).lean();
  }

  static async getAll() {
    return AnalyticStat.find({}).sort({ period: 1, providerName: 1 }).limit(1000).lean();
  }

  static async upsertIncrement(providerName, period, increments) {
    return AnalyticStat.findOneAndUpdate(
      { providerName, period },
      { $inc: increments },
      { returnDocument: "after", upsert: true },
    ).lean();
  }
}

export default AnalyticStatRepository;
