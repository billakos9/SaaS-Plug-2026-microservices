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
   * @param {Object} data
   * @returns {Promise<Object>} Created charger point
   */
  static async create(data) {
    return ChargerPoint.create(data);
  }
}

export default ChargerPointRepository;
