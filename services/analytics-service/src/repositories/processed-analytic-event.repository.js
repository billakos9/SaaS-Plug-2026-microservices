import ProcessedAnalyticEvent from "../models/processed-analytic-event.model.js";

class ProcessedAnalyticEventRepository {
  static async tryInsert(reservationId, eventType) {
    try {
      await ProcessedAnalyticEvent.create({ reservationId: String(reservationId), eventType });
      return true;
    } catch (err) {
      if (err.code === 11000) return false;
      throw err;
    }
  }
}

export default ProcessedAnalyticEventRepository;
