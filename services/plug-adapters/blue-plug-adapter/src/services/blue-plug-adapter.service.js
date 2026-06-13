import { BluePlugHttpClient } from "../http-client.js";
import { toChargerPointsFromBlue } from "../dto/blue-plug.dto.js";

let cachedPoints = [];

class BluePlugAdapterService {
  static async getAll() {
    const raw = await new BluePlugHttpClient().fetchLocations();
    const points = toChargerPointsFromBlue(raw);
    if (points.length > 0) cachedPoints = points;
    return cachedPoints;
  }

  static async reserve(providerName, chargerId, minutes) {
    return new BluePlugHttpClient().reservePoint(chargerId, minutes);
  }
}

export default BluePlugAdapterService;
