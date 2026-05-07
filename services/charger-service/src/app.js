import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging } from "./infrastructure/rabbitMQ.js";
import chargerPointRouter from "./routes/charger.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import {
  startChargerQueueConsumer,
  startReservationQueueConsumer,
} from "./events/rabbitmq.consumers.js";

const app = express();
app.use(express.json());

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

export default app;
