import AppError from "../errors/app-error.js";
import { HttpCode } from "../constants/http-codes.js";
import { ChargerStatus } from "../constants/charger-status.js";

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

export function toChargerPointFromGreen(greenPoint) {
  if (!greenPoint) throw new AppError(HttpCode.BAD_REQUEST, "GreenPoint required");

  let lat = greenPoint.coords?.lat ?? "0";
  let lon = greenPoint.coords?.long ?? "0";

  return {
    id: greenPoint.id,
    ProviderName: "greenPlug",
    longitude: String(lon),
    latitude: String(lat),
    location: {
      type: "Point",
      coordinates: [parseFloat(lon), parseFloat(lat)],
    },
    status: mapGreenStatusToChargerStatus(greenPoint.state),
    cap: greenPoint.cap ?? 0,
    kwhPrice: greenPoint.kwhRateEur ?? 0,
    address: greenPoint.address ?? "Unknown",
    locationName: greenPoint.locationName ?? "greenPlug Station",
    connectionType: greenPoint.connector ?? "Unknown",
  };
}

export function toChargerPointsFromGreen(greenPoints) {
  if (!Array.isArray(greenPoints)) throw new AppError(HttpCode.BAD_REQUEST, "Expected array");
  return greenPoints.map(toChargerPointFromGreen);
}
