import { GreenPlugHttpClient } from "../http-client.js";
import { toChargerPointsFromGreen } from "../dto/green-plug.dto.js";

let cachedPoints = [];

class GreenPlugAdapterService {
  static async getAll() {
    const raw = await new GreenPlugHttpClient().fetchLocations();
    const points = toChargerPointsFromGreen(raw);
    if (points.length > 0) cachedPoints = points;
    return cachedPoints;
  }

  static async reserve(providerName, chargerId, minutes) {
    return new GreenPlugHttpClient().reservePoint(chargerId, minutes);
  }
}

export default GreenPlugAdapterService;
