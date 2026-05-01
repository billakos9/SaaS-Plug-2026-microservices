import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { ChargerStatus } from "../constants/charger-status.js";

/**
 * Maps greenPlug status values to internal charger statuses.
 *
 * @param {string} greenStatus
 * @returns {string}
 */
function mapGreenStatusToChargerStatus(greenStatus) {
  if (!greenStatus) return ChargerStatus.OFFLINE;

  const statusMap = {
    available: ChargerStatus.AVAILABLE,
    busy: ChargerStatus.CHARGING,
    charging: ChargerStatus.CHARGING,
    reserved: ChargerStatus.RESERVED,
    offline: ChargerStatus.OFFLINE,
    malfunction: ChargerStatus.MALFUNCTION,
  };

  return statusMap[greenStatus.toLowerCase()] || ChargerStatus.OFFLINE;
}

/**
 * Transforms a greenPlug provider object into internal charger point format.
 *
 * @param {Object} greenPoint
 * @returns {Object} Charger point DTO
 */
export function toChargerPointFromGreen(greenPoint) {
  if (!greenPoint)
    throw new AppError(HttpCode.BAD_REQUEST, "GreenPoint required");

  if (!Number.isInteger(greenPoint.id)) {
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid id");
  }

  if (!greenPoint.state) {
    throw new AppError(HttpCode.BAD_REQUEST, "State is required");
  }

  return {
    id: greenPoint.id,
    ProviderName: "greenPlug",
    longitude: "0",
    latitude: "0",
    location: {
      type: "Point",
      coordinates: [0, 0],
    },
    status: mapGreenStatusToChargerStatus(greenPoint.state),
    cap: greenPoint.cap ?? 0,
    kwhPrice: greenPoint.kwhRateEur ?? 0,
    address: greenPoint.address ?? "Unknown",
    locationName: greenPoint.locationName ?? "greenPlug Charger",
    connectionType: greenPoint.connector ?? "Unknown",
    reservationEnd: greenPoint.reservedUntil ?? null,
  };
}

/**
 * Transforms an array of greenPlug provider objects into charger point DTOs.
 *
 * @param {Array<Object>} greenPoints
 * @returns {Array<Object>} Charger point DTOs
 */
export function toChargerPointsFromGreen(greenPoints) {
  if (!Array.isArray(greenPoints)) {
    throw new AppError(HttpCode.BAD_REQUEST, "Expected array of GreenPoints");
  }

  return greenPoints.map(toChargerPointFromGreen);
}
