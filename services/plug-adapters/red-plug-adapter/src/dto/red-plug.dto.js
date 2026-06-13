import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { ChargerStatus } from "../constants/charger-status.js";

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

export function toChargerPointFromRed(redPoint) {
  if (!redPoint) throw new AppError(HttpCode.BAD_REQUEST, "RedPoint required");

  let lat = redPoint.lat ?? "0";
  let lon = redPoint.long ?? "0";

  return {
    id: redPoint.pointid,
    ProviderName: "redPlug",
    longitude: String(lon),
    latitude: String(lat),
    location: {
      type: "Point",
      coordinates: [parseFloat(lon), parseFloat(lat)],
    },
    status: mapRedStatusToChargerStatus(redPoint.status),
    cap: redPoint.cap ?? 0,
    kwhPrice: 0,
    address: redPoint.address ?? "Unknown",
    locationName: redPoint.locationName ?? "redPlug Station",
    connectionType: redPoint.connector ?? "Unknown",
  };
}

export function toChargerPointsFromRed(redPoints) {
  if (!Array.isArray(redPoints)) throw new AppError(HttpCode.BAD_REQUEST, "Expected array");
  return redPoints.map(toChargerPointFromRed);
}
