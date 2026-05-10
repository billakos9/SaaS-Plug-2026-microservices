import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { startConsumers } from "./events/rabbitmq.consumers.js";
import analyticsRouter from "./routes/analytics.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.use("/analytics", analyticsRouter);
app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Analytics service running on http://localhost:${PORT}`);
});

async function bootstrap() {
  await connectMongoDB();
  await startConsumers();
}

bootstrap().catch(console.error);

export default app;
