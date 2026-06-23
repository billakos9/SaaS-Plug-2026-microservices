import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import { PlugAdapterHttpClient } from "../http-client.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";

const WATCH_FIELDS = ["status", "kwhPrice", "address", "locationName", "connectionType", "cap", "latitude", "longitude"];
const knownChargers = new Map();

export function startProviderPolling(providers, intervalMinutes = 15) {
  const run = async () => {
    for (const [providerName, providerBaseUrl] of Object.entries(providers)) {
      try {
        const client = new PlugAdapterHttpClient();
        const points = await client.fetchPoints(providerBaseUrl);

        console.log(`Fetched ${points.length} points from ${providerName} (${providerBaseUrl})`);

        for (const point of points) {
          const prev = knownChargers.get(point.id);

          if (!prev) {
            await publishEvent(Exchanges.CHARGER, RoutingKeys.CHARGER_ADD, point);
            knownChargers.set(point.id, { ...point });
          } else {
            const hasChanged = WATCH_FIELDS.some(key => String(prev[key]) !== String(point[key]));
            if (hasChanged) {
              await publishEvent(Exchanges.CHARGER, RoutingKeys.CHARGER_UPDATE, point);
              knownChargers.set(point.id, { ...point });
            } else {
              // No publish needed — still refresh map so prev stays current
              knownChargers.set(point.id, { ...point });
            }
          }
        }
      } catch (err) {
        console.error(`Provider ${providerName} (${providerBaseUrl}) failed:`, err.message);
      }
    }
  };

  run();

  const intervalMilliseconds = intervalMinutes * 60 * 1000;
  setInterval(run, intervalMilliseconds);
}
