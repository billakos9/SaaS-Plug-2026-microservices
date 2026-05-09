import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging } from "./infrastructure/rabbitMQ.js";
import redPlugRouter from "./routes/red-plug.router.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import RedPlugAdapterService from "./services/red-plug-adapter.service.js";

const app = express();
app.use(express.json());

/**
 * Mount the redPlug adapter endpoints.
 */
app.use("/redPlugAdapter", redPlugRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging().catch(err => console.error("RabbitMQ setup failed:", err.message));

RedPlugAdapterService.syncWithProvider(1);

export default app;
