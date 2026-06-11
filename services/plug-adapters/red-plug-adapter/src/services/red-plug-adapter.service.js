import { RedPlugHttpClient } from "../http-client.js";
import { validChargerPointStatus } from "../constants/charger-status.js";
import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import { toChargerPointFromRed } from "../dto/red-plug.dto.js";
import AppError from "../errors/app-error.js";
import ChargerPointRepository from "../repositories/charger-point.repository.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";

class RedPlugAdapterService {
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
      throw new AppError(HttpCode.NOT_FOUND, "Charger point not found");
    }

    return updated;
  }

  /**
   * Reserves a charger point through the redPlug provider and updates its status locally.
   *
   * @param {string} providerName
   * @param {number} chargerId
   * @param {number} minutes
   * @returns {Promise<void>}
   * @throws {AppError} If reservation fails or point is missing
   */
  static async reserve(providerName, chargerId, minutes) {
    const client = new RedPlugHttpClient();
    await client.reservePoint(chargerId, minutes);

    const chargerPoint = await ChargerPointRepository.getById(chargerId);
    if (!chargerPoint)
      throw new AppError(HttpCode.NOT_FOUND, "Charger point not found");

    chargerPoint.status = "reserved";
    await ChargerPointRepository.update(chargerPoint);
  }

  /**
   * Periodically synchronizes charger data from redPlug provider to local database.
   *
   * @param {number} intervalMinutes
   * @returns {void}
   */
  static async syncWithProvider(intervalMinutes = 5) {
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log("Setting up periodic sync with red plug provider...");

    const WATCH_FIELDS = ["status", "kwhPrice", "address", "locationName", "connectionType", "cap", "latitude", "longitude"];

    const performSync = async () => {
      try {
        const Client = new RedPlugHttpClient();
        const providerChargers = await Client.fetchLocations();

        console.log(
          `Fetched ${providerChargers.length} chargers from red provider. Syncing...`,
        );

        for (const chargerData of providerChargers) {
          const chargerDTO = toChargerPointFromRed(chargerData);
          const existingCharger = await ChargerPointRepository.getById(chargerDTO.id);

          if (existingCharger) {
            const hasChanged = WATCH_FIELDS.some(key => existingCharger[key] !== chargerDTO[key]);
            
            await ChargerPointRepository.update({ ...existingCharger, ...chargerDTO });

            if (hasChanged) {
              await publishEvent(Exchanges.CHARGER, RoutingKeys.CHARGER_UPDATE, {
                id:             chargerDTO.id,
                ProviderName:   chargerDTO.ProviderName,
                status:         chargerDTO.status,
                kwhPrice:       chargerDTO.kwhPrice,
                address:        chargerDTO.address,
                locationName:   chargerDTO.locationName,
                connectionType: chargerDTO.connectionType,
                cap:            chargerDTO.cap,
                latitude:       chargerDTO.latitude,
                longitude:      chargerDTO.longitude,
              });
            }
          } else {
            await ChargerPointRepository.create(chargerDTO);
            await publishEvent(Exchanges.CHARGER, RoutingKeys.CHARGER_ADD, chargerDTO);
          }
        }
      } catch (error) {
        console.error("Error during red sync:", error.message);
      }
    };

    performSync();
    setInterval(performSync, intervalMs);
  }
}

export default RedPlugAdapterService;
