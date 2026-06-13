import { RedPlugHttpClient } from "../http-client.js";
import { toChargerPointsFromRed } from "../dto/red-plug.dto.js";

let cachedPoints = [];

class RedPlugAdapterService {
  static async getAll() {
    const raw = await new RedPlugHttpClient().fetchLocations();
    const points = toChargerPointsFromRed(raw);
    if (points.length > 0) cachedPoints = points;
    return cachedPoints;
  }

  static async reserve(providerName, chargerId, minutes) {
    return new RedPlugHttpClient().reservePoint(chargerId, minutes);
  }
}

export default RedPlugAdapterService;
