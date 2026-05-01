import { Exchanges, RoutingKeys } from "../constants/messaging.js";
import { PlugAdapterHttpClient } from "../http-client.js";
import { publishEvent } from "../infrastructure/rabbitMQ.js";

/**
 * Starts a periodic job that:
 * 1. Calls all providers adapters apis to fetch their current charger points.
 * 2. Gets their returned events
 * 3. Publishes them to RabbitMQ
 *
 * @param {Object<string, string>} providers - map of providerName → baseUrls
 * @param {number} intervalMinutes - polling interval in minutes ( default: 15 )
 */
export function startProviderPolling(providers, intervalMinutes = 15) {
  const run = async () => {
    for (const [providerName, providerBaseUrl] of Object.entries(providers)) {
      try {
        const client = new PlugAdapterHttpClient();
        const points = await client.fetchPoints(providerBaseUrl);

        console.log(
          `Fetched ${points.length} points from ${providerName} (${providerBaseUrl})`,
        );
        for (const point of points) {
          await publishEvent(
            Exchanges.CHARGER,
            RoutingKeys.CHARGER_ADD,
            point,
          );
        }
      } catch (err) {
        console.error(
          `Provider ${providerName} (${providerBaseUrl}) failed:`,
          err.message,
        );
      }
    }
  };

  run();

  const intervalMilliseconds = intervalMinutes * 60 * 1000;
  setInterval(run, intervalMilliseconds);
}
