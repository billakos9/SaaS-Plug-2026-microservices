import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { sendMessage, startConsumer } from "./infrastructure/rabbitMQ.js";
import chargerPointRouter from "./routes/charger.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.use("/charger", chargerPointRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

connectMongoDB();
sendMessage("Hello world");
startConsumer();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
