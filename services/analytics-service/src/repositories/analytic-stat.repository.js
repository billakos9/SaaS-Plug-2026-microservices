import AnalyticStat from "../models/analytic-stat.model.js";

class AnalyticStatRepository {
  static async getByProviderAndPeriod(providerName, period) {
    return AnalyticStat.findOne({ providerName, period }).lean();
  }

  static async getAllByPeriod(period) {
    return AnalyticStat.find({ period }).lean();
  }

  static async upsertIncrement(providerName, period, increments) {
    return AnalyticStat.findOneAndUpdate(
      { providerName, period },
      { $inc: increments },
      { new: true, upsert: true },
    ).lean();
  }
}

export default AnalyticStatRepository;
