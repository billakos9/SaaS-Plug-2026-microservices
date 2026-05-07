import { GreenPlugHttpClient } from "../http-client.js";
import { validChargerPointStatus } from "../constants/charger-status.js";
import { HttpCode } from "../constants/http-codes.js";
import { toChargerPointFromGreen } from "../dto/green-plug.dto.js";
import AppError from "../errors/app-error.js";
import ChargerPointRepository from "../repositories/charger-point.repository.js";

class GreenPlugAdapterService {
  /**
   * Retrieves all charger points from the local repository.
   *
   * @returns {Promise<Array<Object>>} List of charger points
   */
  static async getAll() {
    return ChargerPointRepository.getAll();
  }

  /**
   * Creates a new charger point after validating its status.
   *
   * @param {Object} chargerData
   * @returns {Promise<Object>} Created charger point
   */
  static async create(chargerData) {
    validChargerPointStatus(chargerData.status);
    return ChargerPointRepository.create(chargerData);
  }

  /**
   * Updates an existing charger point in the repository.
   *
   * @param {Object} chargerPointData
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
   * Reserves a charger point through the greenPlug provider and updates its status locally.
   *
   * @param {string} providerName
   * @param {number} chargerId
   * @param {number} minutes
   * @returns {Promise<void>}
   * @throws {AppError} If reservation fails or point is missing
   */
  static async reserve(providerName, chargerId, minutes) {
    const client = new GreenPlugHttpClient();
    await client.reservePoint(chargerId, minutes);

    const chargerPoint = await ChargerPointRepository.getById(chargerId);
    if (!chargerPoint)
      throw new AppError("Charger point not found", HttpCode.NOT_FOUND);

    chargerPoint.status = "reserved";
    await ChargerPointRepository.update(chargerPoint);
  }

  /**
   * Periodically synchronizes charger data from greenPlug provider to local database.
   *
   * @param {number} intervalMinutes
   * @returns {void}
   */
  static async syncWithProvider(intervalMinutes = 5) {
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log("Fetching chargers from green plug provider...");

    setInterval(async () => {
      try {
        const Client = new GreenPlugHttpClient();
        const providerChargers = await Client.fetchLocations();

        console.log(
          `Fetched ${providerChargers.length} chargers from provider. Syncing with local database...`,
        );

        for (const chargerData of providerChargers) {
          const chargerDTO = toChargerPointFromGreen(chargerData);
          const existingCharger = await ChargerPointRepository.getById(
            chargerDTO.id,
          );

          if (existingCharger) {
            await ChargerPointRepository.update({
              ...existingCharger,
              ...chargerDTO,
            });
          } else {
            await ChargerPointRepository.create(chargerDTO);
          }
        }
      } catch (error) {
        console.error("Error during sync interval:", error.message);
      }
    }, intervalMs);
  }
}

export default GreenPlugAdapterService;
