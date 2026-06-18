import express from "express";
import mongoose from "mongoose";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import { startEventConsumers } from "./events/rabbitmq.consumers.js";
import SessionMonitorService from "./services/session-monitor.service.js";
import reservationRouter from "./routes/reservation.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "operational" : "degraded" });
});

app.use("/reservation", reservationRouter);
app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

async function bootstrap() {
  await connectMongoDB();
  await setupMessaging();
  await startEventConsumers();
  onReconnect(startEventConsumers);
  SessionMonitorService.start();
  app.listen(PORT, () => {
    console.log(`Reservation service running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[reservation-service] Fatal startup error:", err);
  process.exit(1);
});

export default app;
