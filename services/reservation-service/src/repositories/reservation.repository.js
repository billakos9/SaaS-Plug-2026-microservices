import Counter from "../models/counter.model.js";
import Reservation from "../models/reservation.model.js";

/**
 * Data-access layer for the Reservation collection.
 *
 * All methods are static — no instance needs to be created.
 * Direct MongoDB interactions (queries, updates) are isolated here so that
 * the service layer remains free of persistence concerns.
 */
class ReservationRepository {
  /**
   * Atomically increments and returns the next sequential reservation ID.
   *
   * Uses a dedicated Counter document (name: "reservationId") with an upsert
   * so the counter is created automatically on first use.
   *
   * @returns {Promise<number>} The next unique reservation ID
   */
  static async getNextId() {
    const counter = await Counter.findOneAndUpdate(
      { name: "reservationId" },
      { $inc: { value: 1 } },
      { returnDocument: "after", upsert: true },
    );
    return counter.value;
  }

  /**
   * Retrieves a single reservation by its numeric ID.
   *
   * @param {number} reservationId - The unique numeric reservation identifier
   * @returns {Promise<Object|null>} A lean reservation document, or null if not found
   */
  static async getById(reservationId) {
    return Reservation.findOne({ reservationId }).lean();
  }

  /**
   * Retrieves all reservations belonging to a specific user.
   *
   * @param {number} userId - The numeric user identifier
   * @returns {Promise<Object[]>} Array of lean reservation documents (may be empty)
   */
  static async getByUserId(userId) {
    return Reservation.find({ userId }).lean();
  }

  static async getActiveByUserId(userId) {
    return Reservation.findOne({ userId, status: "active" }).lean();
  }

  static async findActiveByUserId(userId) {
    return Reservation.find({ userId, status: "active" }).lean();
  }

  static async getActiveByChargerId(chargerId) {
    return Reservation.findOne({ chargerId, status: "active" }).lean();
  }

  static async getCompletedByProviderAndPeriod(providerName, period) {
    const [year, month] = period.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 1);
    return Reservation.find({
      providerName,
      status: { $in: ["completed", "cancelled"] },
      createdAt: { $gte: start, $lt: end },
    }).sort({ createdAt: 1 }).lean();
  }

  /**
   * Persists a new reservation document to the database.
   *
   * @param {{ reservationId: number, userId: number, chargerId: number, providerName: string, duration: number, status: string }} data - Reservation fields to store
   * @returns {Promise<Object>} The newly created Mongoose reservation document
   */
  static async create(data) {
    return Reservation.create(data);
  }

  /**
   * Atomically updates a reservation only if it is currently "active".
   *
   * Used as a concurrency guard so that two racing writers (e.g. a user's
   * cancel request and the session-monitor's expiry sweep) cannot both
   * successfully finalize the same reservation. Only the first writer to
   * reach MongoDB will see a non-null result; the loser receives null and
   * must treat the reservation as already finalized.
   *
   * @param {number} reservationId - The unique numeric reservation identifier
   * @param {Object} fields - The fields to update
   * @returns {Promise<Object|null>} The updated lean reservation document, or null if it was not "active"
   */
  static async updateIfActive(reservationId, fields) {
    return Reservation.findOneAndUpdate(
      { reservationId, status: "active" },
      { $set: fields },
      { returnDocument: "after" },
    ).lean();
  }
}

export default ReservationRepository;
