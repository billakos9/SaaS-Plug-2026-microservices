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
   * Finds charger points near coordinates
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radiusKm - Search radius in kilometres (deafult: 5)
   * @returns {Promise<Array<Object>>} Matching charger points sorted by distance
   */

  static async getByLocation(latitude, longitude, radiusKm = 5) {
    return ChargerPoint.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: radiusKm * 1000,
        },
      },
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

    return ChargerPoint.findOneAndUpdate({ id }, { $set: updateData }, { returnDocument: "after" }).lean();
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

  /**
   * Sets all charger points belonging to a provider to "offline".
   *
   * Called when a provider.delete event is received so that orphaned chargers
   * are no longer shown as available.
   *
   * @param {string} providerName - The provider whose chargers should be marked offline
   * @returns {Promise<import("mongoose").UpdateWriteOpResult>} Mongoose updateMany result
   */
  static async markOfflineByProvider(providerName) {
    // NOTE: `ProviderName` (capital P) must match the schema field in charger-point.model.js exactly.
    return ChargerPoint.updateMany({ ProviderName: providerName }, { $set: { status: "offline" } });
  }
}

export default ChargerPointRepository;
