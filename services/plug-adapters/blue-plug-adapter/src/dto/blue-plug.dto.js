import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { ChargerStatus } from "../constants/charger-status.js";

function mapBlueStatusToChargerStatus(blueStatus) {
  if (!blueStatus) return ChargerStatus.OFFLINE;
  const statusMap = {
    available: ChargerStatus.AVAILABLE,
    busy: ChargerStatus.CHARGING,
    reserved: ChargerStatus.RESERVED,
    offline: ChargerStatus.OFFLINE,
    malfunction: ChargerStatus.MALFUNCTION,
  };
  return statusMap[blueStatus.toLowerCase()] || ChargerStatus.OFFLINE;
}

export function toChargerPointFromBlue(bluePoint) {
  if (!bluePoint) throw new AppError(HttpCode.BAD_REQUEST, "BluePoint required");

  let lat = bluePoint.geo && bluePoint.geo.length === 2 ? bluePoint.geo[1] : "0";
  let lon = bluePoint.geo && bluePoint.geo.length === 2 ? bluePoint.geo[0] : "0";

  return {
    id: bluePoint.chargerId,
    ProviderName: "bluePlug",
    longitude: String(lon),
    latitude: String(lat),
    location: {
      type: "Point",
      coordinates: [parseFloat(lon), parseFloat(lat)],
    },
    status: mapBlueStatusToChargerStatus(bluePoint.currentStatus),
    cap: bluePoint.cap ?? 0,
    kwhPrice: bluePoint.pricePerKwh ?? 0.59,
    address: bluePoint.address ?? "Unknown",
    locationName: bluePoint.locationName ?? "bluePlug Station",
    connectionType: bluePoint.connector ?? "Unknown",
  };
}

export function toChargerPointsFromBlue(bluePoints) {
  if (!Array.isArray(bluePoints)) throw new AppError(HttpCode.BAD_REQUEST, "Expected array");
  return bluePoints.map(toChargerPointFromBlue);
}
