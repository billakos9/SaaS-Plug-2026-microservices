import express from "express";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import bluePlugRouter from "./routes/blue-plug.router.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";
import BluePlugAdapterService from "./services/blue-plug-adapter.service.js";

const app = express();
app.use(express.json());

app.use("/bluePlugAdapter", bluePlugRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectMongoDB();

BluePlugAdapterService.syncWithProvider(1);

export default app;
