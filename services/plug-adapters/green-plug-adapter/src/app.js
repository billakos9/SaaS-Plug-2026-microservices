import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging } from "./infrastructure/rabbitMQ.js";
import greenPlugRouter from "./routes/green-plug.router.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import GreenPlugAdapterService from "./services/green-plug-adapter.service.js";

const app = express();
app.use(express.json());

/**
 * Mount the greenPlug adapter endpoints.
 */
app.use("/greenPlugAdapter", greenPlugRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging()
  .then(() => {
    console.log("Messaging setup complete. Starting provider sync...");
    GreenPlugAdapterService.syncWithProvider(1);
  })
  .catch((err) => {
    console.error("RabbitMQ setup failed:", err.message);
  });

export default app;
