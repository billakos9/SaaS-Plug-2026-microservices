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
      { new: true, upsert: true },
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
   * Updates fields of an existing reservation and returns the updated document.
   *
   * @param {number} reservationId - The unique numeric reservation identifier
   * @param {Object} fields - The fields to update
   * @returns {Promise<Object|null>} The updated lean reservation document, or null if not found
   */
  static async update(reservationId, fields) {
    return Reservation.findOneAndUpdate(
      { reservationId },
      { $set: fields },
      { new: true },
    ).lean();
  }
}

export default ReservationRepository;
