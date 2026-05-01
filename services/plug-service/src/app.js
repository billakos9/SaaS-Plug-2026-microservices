import { PROVIDER_BASE_URLS } from "./constants/provider-base-url.js";
import { startChargerQueueConsumer } from "./events/rabbitmq.consumer.js";
import { setupMessaging } from "./infrastructure/rabbitMQ.js";
import { startProviderPolling } from "./jobs/provider-polling.job.js";

setupMessaging();
startChargerQueueConsumer();

startProviderPolling(PROVIDER_BASE_URLS, 1);

console.log("Plug Service running (event-driven)");
