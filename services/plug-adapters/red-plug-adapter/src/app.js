import express from "express";

import { PORT } from "./config/env.js";
import redPlugRouter from "./routes/red-plug.router.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/redPlugAdapter", redPlugRouter);
app.use(unmatchedRouteMiddleware);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
