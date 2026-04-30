import { PROVIDER_BASE_URLS } from "./constants/provider-base-url.js";
import {
  setupMessaging,
  startChargerQueueConsumer
} from "./infrastructure/rabbitMQ.js";
import { startProviderPolling } from "./jobs/provider-polling.job.js";

setupMessaging();
startChargerQueueConsumer();

startProviderPolling(PROVIDER_BASE_URLS, 1);

console.log("Plug Service running (event-driven)");
