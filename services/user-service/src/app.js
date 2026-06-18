import express from "express";
import mongoose from "mongoose";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect, publishEvent } from "./infrastructure/rabbitMQ.js";
import { startOutboxRelay } from "./infrastructure/outbox.js";
import userRouter from "./routes/user.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { startUserQueueConsumer } from "./events/rabbitmq.consumer.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "operational" : "degraded" });
});

app.use("/user", userRouter);

app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

async function bootstrap() {
  await connectMongoDB();
  await setupMessaging();
  await startUserQueueConsumer();
  onReconnect(startUserQueueConsumer);
  startOutboxRelay(publishEvent);
  app.listen(PORT, () => {
    console.log(`User service running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[user-service] Fatal startup error:", err);
  process.exit(1);
});

export default app;
