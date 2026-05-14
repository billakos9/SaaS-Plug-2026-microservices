import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { ChargerStatus } from "../constants/charger-status.js";

/**
 * Maps bluePlug API status to internal charger status
 * @param {string} blueStatus - Status from bluePlug API
 * @returns {string} Internal charger status
 */
function mapBlueStatusToChargerStatus(blueStatus) {
  if (!blueStatus) return ChargerStatus.OFFLINE;

  const statusMap = {
    available:   ChargerStatus.AVAILABLE,
    busy:        ChargerStatus.CHARGING,
    reserved:    ChargerStatus.RESERVED,
    offline:     ChargerStatus.OFFLINE,
    malfunction: ChargerStatus.MALFUNCTION,
  };

  return statusMap[blueStatus.toLowerCase()] || ChargerStatus.OFFLINE;
}

/**
 * Validates and transforms a BluePoint to internal charger format
 * @param {Object} bluePoint - Raw response from bluePlug API
 * @returns {Object} Charger point DTO
 * @throws {AppError} If required fields are missing
 */
export function toChargerPointFromBlue(bluePoint) {
  if (!bluePoint)
    throw new AppError(HttpCode.BAD_REQUEST, "BluePoint required");

  if (!Number.isInteger(bluePoint.chargerId)) {
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid chargerId");
  }

  if (!bluePoint.currentStatus) {
    throw new AppError(HttpCode.BAD_REQUEST, "Status is required");
  }

  return {
    id: bluePoint.chargerId,
    ProviderName: "bluePlug",
    longitude: "0",
    latitude: "0",
    location: {
      type: "Point",
      coordinates: [
        0,
        0,
      ],
    },
    status: mapBlueStatusToChargerStatus(bluePoint.currentStatus),
    cap: bluePoint.cap ?? 0,
    kwhPrice: bluePoint.pricePerKwh ?? 0.59,
    address: bluePoint.address ?? "Unknown",
    locationName: bluePoint.locationName ?? "bluePlug Charger",
    connectionType: bluePoint.connector ?? "Unknown",
    reservationEnd: bluePoint.reservationEnd ?? null,
  };
}

/**
 * Transforms array of BluePoints
 * @param {Array<Object>} bluePoints - Array from bluePlug API
 * @returns {Array<Object>} Array of charger point DTOs
 */
export function toChargerPointsFromBlue(bluePoints) {
  if (!Array.isArray(bluePoints)) {
    throw new AppError(HttpCode.BAD_REQUEST, "Expected array of BluePoints");
  }

  return bluePoints.map(toChargerPointFromBlue);
}
