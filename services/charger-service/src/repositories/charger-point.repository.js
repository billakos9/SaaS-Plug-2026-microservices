import ChargerPoint from "../models/charger-point.model.js";

class ChargerPointRepository {
  /**
   * Returns a charger point by its numeric id
   * @param {number} id
   * @returns {Promise<Object|null>} Charger point document or null
   */
  static async getById(id) {
    return ChargerPoint.findOne({ id }).lean();
  }

  /**
   * Returns all charger points
   * @returns {Promise<Array<Object>>} List of charger points
   */
  static async getAll() {
    return ChargerPoint.find({}).lean();
  }

  /**
   * Returns all charger points with specified status
   * @returns {Promise<Array<Object>>} List of charger points
   */
  static async getAllByStatus(status) {
    return ChargerPoint.find({ status }).lean();
  }

  /**
   * Finds charger points near coordinates (exact match or simple proximity filter)
   * @param {string} latitude
   * @param {string} longitude
   * @returns {Promise<Array<Object>>} Matching charger points
   */
  static async getByLocation(latitude, longitude) {
    return ChargerPoint.find({
      latitude,
      longitude,
    }).lean();
  }

  /**
   * Creates a new charger point
   * @param {Object} chargerData
   * @returns {Promise<Object>} Created charger point
   */
  static async create(chargerData) {
    return ChargerPoint.create(chargerData);
  }

  /**
   * Updates a charger point if it exists
   *
   * @param {Object} updatedChargerData - Data containing id and fields to update
   * @returns {Promise<Object|null>} Updated document or null if not found
   */
  static async update(updatedChargerData) {
    const { id, ...updateData } = updatedChargerData;

    return ChargerPoint.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true },
    );
  }

  /**
   * Deletes a charger point by id
   *
   * @param {number} chargerId - Charger point ID
   * @returns {Promise<{ deletedCount: number }>} Result of delete operation
   */
  static async delete(chargerId) {
    return ChargerPoint.deleteOne({ id: chargerId });
  }
}

export default ChargerPointRepository;
