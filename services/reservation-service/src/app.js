import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging } from "./infrastructure/rabbitMQ.js";
import SessionMonitorService from "./services/session-monitor.service.js";
import reservationRouter from "./routes/reservation.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/reservation", reservationRouter);
app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Reservation service running on http://localhost:${PORT}`);
});

connectMongoDB();
setupMessaging();
SessionMonitorService.start();

export default app;
