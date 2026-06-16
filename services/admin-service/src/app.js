import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import { startEventConsumers } from "./events/rabbitmq.consumers.js";
import adminRouter from "./routes/admin.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

/**
 * Bootstraps the Express application, wires middleware and routes, starts the
 * HTTP server, and initialises MongoDB, RabbitMQ, and event consumers.
 */
const app = express();
app.use(express.json());

app.use("/admin", adminRouter);
app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Admin service running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging();
startEventConsumers();

onReconnect(startEventConsumers);

export default app;
