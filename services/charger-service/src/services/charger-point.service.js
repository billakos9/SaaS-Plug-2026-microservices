import { validChargerPointStatus } from "../constants/charger-status.js";
import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";
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
   * Retrieves charger points near given coordinates
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radiusKm - search radius in kilometers (default: 5)
   * @returns {Promise<Array<Object>>} Matching charger points sorted by distance
   */
  static async getByLocation(latitude, longitude, radiusKm) {
    return ChargerPointRepository.getByLocation(latitude, longitude, radiusKm);
  }

  /**
   * Creates a new charger point
   * @param {Object} chargerData
   * @returns {Promise<Object>} Created charger point
   */
  static async create(chargerData) {
    validChargerPointStatus(chargerData.status);
    return ChargerPointRepository.create(chargerData);
  }

  /**
   * Updates a charger point only if it exists
   *
   * @param {Object} chargerPointData - ChargerPoint DTO
   * @returns {Promise<Object>} Updated charger point
   * @throws {AppError} If charger point does not exist
   */
  static async update(chargerPointData) {
    validChargerPointStatus(chargerPointData.status);

    const updated = await ChargerPointRepository.update(chargerPointData);

    if (!updated) {
      throw new AppError("Charger point not found", HttpCode.NOT_FOUND);
    }

    return updated;
  }

  /**
   * Creates a update charger point
   * @param {Object} chargerId Updated charger point
   * @returns {Promise<Void>}
   */
  static async delete(chargerId) {
    ChargerPointRepository.delete(chargerId);
  }
}

export default ChargerPointService;
