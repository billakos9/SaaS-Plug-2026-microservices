import express from "express";
import bcrypt from "bcrypt";
import { PORT } from "./config/env.js";
import connectMongoDB from "./infrastructure/mongoDB.js";
import { setupMessaging, onReconnect } from "./infrastructure/rabbitMQ.js";
import AuthUserRepository from "./repositories/auth-user.repository.js";
import { setupAuthConsumers } from "./events/rabbitmq.consumers.js";
import authRouter from "./routes/auth.route.js";
import unmatchedRouteMiddleware from "./middleware/unmatched-routes.middleware.js";
import errorMiddleware from "./middleware/error.middleware.js";

const KNOWN_ADMINS = [
  { email: "admin@saas.com",        password: "123456" },
  { email: "admin@saasplug.app",    password: "123456" },
  { email: "agrinios@saasplug.app", password: "123456" },
];

async function migrateAdminAccounts() {
  for (const a of KNOWN_ADMINS) {
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

app.get("/health", (_req, res) => res.json({ status: "ok" }));
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