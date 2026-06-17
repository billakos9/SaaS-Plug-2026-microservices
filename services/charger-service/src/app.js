import express from "express";
import mongoose from "mongoose";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import chargerPointRouter from "./routes/charger.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import {
  startChargerQueueConsumer,
  startReservationQueueConsumer,
  startTokenRevocationConsumer,
} from "./events/rabbitmq.consumers.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "operational" : "degraded" });
});

app.use("/charger", chargerPointRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging();
startChargerQueueConsumer();
startReservationQueueConsumer();
startTokenRevocationConsumer();

onReconnect(async () => {
  await startChargerQueueConsumer();
  await startReservationQueueConsumer();
  await startTokenRevocationConsumer();
});

export default app;
