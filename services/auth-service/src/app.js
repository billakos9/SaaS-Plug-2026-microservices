import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import AuthUserRepository from "./repositories/auth-user.repository.js";
import { setupAuthConsumers } from "./events/rabbitmq.consumers.js";
import authRouter from "./routes/auth.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

function parseAdminSeeds() {
  const raw = process.env.SEED_ADMIN_CREDENTIALS;
  if (!raw || !raw.trim()) return [];
  return raw.split(",").map((entry) => {
    const idx = entry.indexOf(":");
    if (idx === -1) return null;
    return { email: entry.slice(0, idx).trim(), password: entry.slice(idx + 1).trim() };
  }).filter(Boolean);
}

async function migrateAdminAccounts() {
  const admins = parseAdminSeeds();
  if (admins.length === 0) {
    console.warn("[migration] SEED_ADMIN_CREDENTIALS not set — skipping admin seed.");
    return;
  }
  for (const a of admins) {
    const existing = await AuthUserRepository.findByEmail(a.email);
    if (!existing) {
      const userId = await AuthUserRepository.getNextId();
      const passwordHash = await bcrypt.hash(a.password, 10);
      await AuthUserRepository.create({ userId, email: a.email, passwordHash, role: "admin" });
      console.log(`[migration] Created admin AuthUser for ${a.email} (userId=${userId})`);
    }
  }
}

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "operational" : "degraded" });
});
app.use("/auth", authRouter);
app.use(unmatchedRouteMiddleware);
app.use(errorMiddleware);

async function bootstrap() {
  await connectMongoDB();
  await migrateAdminAccounts();
  await setupMessaging();
  onReconnect(setupAuthConsumers);
  app.listen(PORT, () => {
    console.log(`Auth service running on http://localhost:${PORT}`);
  });
}

bootstrap();

export default app;