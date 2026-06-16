import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import userRouter from "./routes/user.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import { startUserQueueConsumer } from "./events/rabbitmq.consumer.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/user", userRouter);

app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`User service running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging()
  .then(startUserQueueConsumer)
  .then(() => {
    onReconnect(startUserQueueConsumer);
  })
  .catch((error) => {
    console.error("User service messaging bootstrap failed:", error);
  });

export default app;
