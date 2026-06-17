import http from "node:http";
import { PROVIDER_BASE_URLS } from "./constants/provider-base-url.js";
import { startChargerQueueConsumer } from "./events/rabbitmq.consumer.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import { startProviderPolling } from "./jobs/provider-polling.job.js";
import { PORT, POLL_INTERVAL_MINUTES } from "./config/env.js";

(async () => {
  await setupMessaging();
  await startChargerQueueConsumer();
  onReconnect(startChargerQueueConsumer);
  startProviderPolling(PROVIDER_BASE_URLS, Number(POLL_INTERVAL_MINUTES) || 15);
})().catch((err) => {
  console.error("[Plug Service] Bootstrap failed:", err.message);
  process.exit(1);
});

const port = PORT ?? 3000;
http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(port, () => console.log(`Plug Service running on port ${port} (event-driven)`));
