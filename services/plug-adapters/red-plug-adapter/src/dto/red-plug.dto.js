import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { ChargerStatus } from "../constants/charger-status.js";

/**
 * Maps redPlug status values to internal charger statuses.
 *
 * @param {string} redStatus
 * @returns {string}
 */
function mapRedStatusToChargerStatus(redStatus) {
  if (!redStatus) return ChargerStatus.OFFLINE;

  const statusMap = {
    available: ChargerStatus.AVAILABLE,
    reserved: ChargerStatus.RESERVED,
    busy: ChargerStatus.CHARGING,
    charging: ChargerStatus.CHARGING,
    occupied: ChargerStatus.CHARGING,
    offline: ChargerStatus.OFFLINE,
    malfunction: ChargerStatus.MALFUNCTION,
  };

  return statusMap[redStatus.toLowerCase()] || ChargerStatus.OFFLINE;
}

/**
 * Transforms a redPlug provider object into internal charger point format.
 *
 * @param {Object} redPoint
 * @returns {Object} Charger point DTO
 */
export function toChargerPointFromRed(redPoint) {
  if (!redPoint) throw new AppError(HttpCode.BAD_REQUEST, "RedPoint required");

  if (!Number.isInteger(redPoint.pointid)) {
    throw new AppError(HttpCode.BAD_REQUEST, "Invalid pointid");
  }

  if (!redPoint.status) {
    throw new AppError(HttpCode.BAD_REQUEST, "Status is required");
  }

  return {
    id: redPoint.pointid,
    ProviderName: "redPlug",
    longitude: "0",
    latitude: "0",
    location: {
      type: "Point",
      coordinates: [0, 0],
    },
    status: mapRedStatusToChargerStatus(redPoint.status),
    cap: redPoint.cap ?? 0,
    kwhPrice: 0,
    address: redPoint.address ?? "Unknown",
    locationName: redPoint.locationName ?? "redPlug Charger",
    connectionType: redPoint.connector ?? "Unknown",
    reservationEnd: redPoint.reservationendtime ?? null,
  };
}

/**
 * Transforms an array of redPlug provider objects into charger point DTOs.
 *
 * @param {Array<Object>} redPoints
 * @returns {Array<Object>} Charger point DTOs
 */
export function toChargerPointsFromRed(redPoints) {
  if (!Array.isArray(redPoints)) {
    throw new AppError(HttpCode.BAD_REQUEST, "Expected array of RedPoints");
  }

  return redPoints.map(toChargerPointFromRed);
}
