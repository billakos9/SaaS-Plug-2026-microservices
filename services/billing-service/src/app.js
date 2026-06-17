import express from "express";
import mongoose from "mongoose";

import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { startBillingConsumers } from "./events/rabbitmq.consumers.js";
import { onReconnect } from "./infrastructure/rabbitMQ.js";
import { startInvoiceGenerationJob } from "./jobs/invoice-generation.job.js";
import invoiceRouter from "./routes/invoice.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "operational" : "degraded" });
});
app.use("/billing/invoices", invoiceRouter);
app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Billing service running on http://localhost:${PORT}`);
});

async function bootstrap() {
  await connectMongoDB();
  await startBillingConsumers();
  onReconnect(startBillingConsumers);
  startInvoiceGenerationJob();
}

bootstrap().catch(console.error);

export default app;
