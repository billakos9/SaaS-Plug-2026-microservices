import { BluePlugHttpClient } from "../http-client.js";
import { validChargerPointStatus } from "../constants/charger-status.js";
import { HttpCode } from "../constants/http-codes.js";
import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import { toChargerPointFromBlue } from "../dto/blue-plug.dto.js";
import AppError from "../errors/app-error.js";
import ChargerPointRepository from "../repositories/charger-point.repository.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";

class BluePlugAdapterService {
  /**
   * Retrieves all charger points
   * @returns {Promise<Array<Object>>} List of charger points
   */
  static async getAll() {
    return ChargerPointRepository.getAll();
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
      throw new AppError(HttpCode.NOT_FOUND, "Charger point not found");
    }

    return updated;
  }

  /**
   * Reserves a charger point through the provider and updates its status to "reserved"
   * @param {String} providerName - The name of the provider responsible for the charger
   *
   * @param {Number} chargerId - The Id of the charger point to reserve
   * @param {Number} minutes - The duration of the reservation in minutes
   * @returns {Promise<void>} - Resolves when reservation is successful
   *
   * @throws {AppError} If the provider is not found or reservation fails
   */
  static async reserve(providerName, chargerId, minutes) {
    const chargerPoint = await ChargerPointRepository.getById(chargerId);
    if (!chargerPoint)
      throw new AppError(HttpCode.NOT_FOUND, "Charger point not found");

    chargerPoint.status = "reserved";
    await ChargerPointRepository.update(chargerPoint);

    await new BluePlugHttpClient().reservePoint(chargerId, minutes);
  }

  /**
   * This function will be responsible for calling the provider's API to get all the chargers and
   * updating the local database accordingly. It will be called periodically to sync data.
   *
   * Fetch data from provider API, then for each charger point:
   *  - If it exists in the local DB, update its details and status
   *  - If it doesn't exist, create a new record in the local DB
   *  - If a charger point exists locally but not in the provider data, consider marking it as "unavailable"
   *    or removing it based on business rules
   *
   * @param {number} intervalMinutes - How often to sync with the provider in minutes (default: 5)
   * @returns {void}
   * @throws {AppError} If fetching from provider fails
   */
  static async syncWithProvider(intervalMinutes = 5) {
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log("Setting up periodic sync with blue plug provider...");

    const WATCH_FIELDS = ["status", "kwhPrice", "address", "locationName", "connectionType", "cap", "latitude", "longitude"];

    const performSync = async () => {
      try {
        const Client = new BluePlugHttpClient();
        const providerChargers = await Client.fetchLocations();

        console.log(
          `Fetched ${providerChargers.length} chargers from blue provider. Syncing...`,
        );

        for (const chargerData of providerChargers) {
          const chargerDTO = toChargerPointFromBlue(chargerData);
          const existingCharger = await ChargerPointRepository.getById(chargerDTO.id);

          if (existingCharger) {
            const hasChanged = WATCH_FIELDS.some(key => existingCharger[key] !== chargerDTO[key]);

            await ChargerPointRepository.update({ ...existingCharger, ...chargerDTO });

            if (hasChanged) {
              await publishEvent(Exchanges.CHARGER, RoutingKeys.CHARGER_UPDATE, {
                id:           chargerDTO.id,
                ProviderName: chargerDTO.ProviderName,
                status:       chargerDTO.status,
                kwhPrice:     chargerDTO.kwhPrice,
                address:      chargerDTO.address,
                locationName: chargerDTO.locationName,
                connectionType: chargerDTO.connectionType,
                cap:          chargerDTO.cap,
                latitude:     chargerDTO.latitude,
                longitude:    chargerDTO.longitude,
              });
            }
          } else {
            await ChargerPointRepository.create(chargerDTO);
            // Also publish on creation
             await publishEvent(Exchanges.CHARGER, RoutingKeys.CHARGER_ADD, chargerDTO);
          }
        }
      } catch (error) {
        console.error("Error during blue sync:", error.message);
      }
    };

    // Run once immediately
    performSync();

    // Then set interval
    setInterval(performSync, intervalMs);
  }
}

export default BluePlugAdapterService;
