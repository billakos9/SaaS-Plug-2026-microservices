/**
 * Application entry point.
 *
 * Bootstraps the Express server, connects to MongoDB, sets up RabbitMQ
 * messaging infrastructure, and starts the provider queue consumer.
 */
import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging } from "./infrastructure/rabbitMQ.js";
import providerRouter from "./routes/provider.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { startProviderQueueConsumer } from "./events/rabbitmq.consumers.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/provider", providerRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging();
startProviderQueueConsumer();

export default app;
