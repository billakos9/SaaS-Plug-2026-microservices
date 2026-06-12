import { validChargerPointStatus } from "../constants/charger-status.js";
import { HttpCode } from "../constants/http-codes.js";
import AppError from "../errors/app-error.js";
import ChargerPointRepository from "../repositories/charger-point.repository.js";
import { enrichLocationData } from "../utils/geocoding.js";

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
   * Creates a new charger point or updates if it already exists
   * @param {Object} chargerData
   * @returns {Promise<Object>} Created charger point
   */
  static async create(chargerData) {
    validChargerPointStatus(chargerData.status);
    const enrichedData = await enrichLocationData(chargerData);
    if (enrichedData.id) {
      const existing = await ChargerPointRepository.getById(enrichedData.id);
      if (existing) {
        return ChargerPointRepository.update(enrichedData);
      }
    }
    return ChargerPointRepository.create(enrichedData);
  }

  /**
   * Updates a charger point only if it exists
   *
   * @param {Object} chargerPointData - ChargerPoint DTO
   * @param {boolean} skipEnrichment - If true, skips expensive geocoding logic (useful for status-only updates)
   * @returns {Promise<Object>} Updated charger point
   * @throws {AppError} If charger point does not exist
   */
  static async update(chargerPointData, skipEnrichment = false) {
    validChargerPointStatus(chargerPointData.status);
    
    let dataToUpdate = chargerPointData;
    
    // Only enrich if not explicitly skipped AND we have location hints
    const hasLocationHints = chargerPointData.address || chargerPointData.latitude || chargerPointData.longitude;
    if (!skipEnrichment && hasLocationHints) {
      dataToUpdate = await enrichLocationData(chargerPointData);
    }

    const updated = await ChargerPointRepository.update(dataToUpdate);

    if (!updated) {
      throw new AppError(HttpCode.NOT_FOUND, "Charger point not found");
    }

    return updated;
  }

  /**
   * Deletes a charger point by id
   *
   * @param {number} chargerId - ID of the charger point to remove
   * @returns {Promise<{ deletedCount: number }>} Result of the delete operation
   */
  static async delete(chargerId) {
    return ChargerPointRepository.delete(chargerId);
  }
}

export default ChargerPointService;
