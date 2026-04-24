import { validChargerPointStatus } from "../constants/charger-status.js";
import ChargerPointRepository from "../repositories/charger-point.repository.js";

class ChargerPointService {
  /**
   * Retrieves a charger point by id
   * @param {number} id
   * @returns {Promise<Object|null>} Charger point or null if not found
   */
  static async getById(id) {
    return ChargerPointRepository.getById(id);
  }

  /**
   * Retrieves all charger points by status
   * @param {number} status
   * @returns {Promise<Array<Object>>} List of charger points
   */
  static async getAllByStatus(status) {
    validChargerPointStatus(status);
    return ChargerPointRepository.getAllByStatus(status);
  }

  /**
   * Retrieves all charger points
   * @returns {Promise<Array<Object>>} List of charger points
   */
  static async getAll() {
    return ChargerPointRepository.getAll();
  }

  /**
   * Retrieves charger points by exact coordinate match
   * @param {string} latitude
   * @param {string} longitude
   * @returns {Promise<Array<Object>>} Matching charger points
   */
  static async getByLocation(latitude, longitude) {
    return ChargerPointRepository.getByLocation(latitude, longitude);
  }

  /**
   * Creates a new charger point
   * @param {Object} data
   * @returns {Promise<Object>} Created charger point
   */
  static async create(data) {
    return ChargerPointRepository.create(data);
  }
}

export default ChargerPointService;
