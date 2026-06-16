/**
 * Loads environment variables from the appropriate .env file based on NODE_ENV.
 * Falls back to .env.development.local when running in production without a
 * dedicated production env file. Exports all required environment variables for
 * use throughout the service.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";

const runtimeEnv = process.env.NODE_ENV || "development";
const envPath = `.env.${runtimeEnv}.local`;
const fallbackEnvPath = ".env.development.local";

console.log(`Attempting to load environment file from: ${envPath}`);

let result = config({ path: envPath });

if (
  result.error &&
  runtimeEnv === "production" &&
  existsSync(fallbackEnvPath)
) {
  console.warn(
    `Production env file not found. Falling back to: ${fallbackEnvPath}`,
  );
  result = config({ path: fallbackEnvPath });
}

if (result.error) {
  if (result.error.code === "ENOENT") {
    console.log("No .env file found — using environment variables from the container.");
  } else {
    console.error("Error loading .env file:", result.error);
    process.exit(1);
  }
}

for (const key of ["JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`${key} is required`);
    process.exit(1);
  }
}

export const {
  PORT,
  MONGOOSE_URL,
  RABBITMQ_URL,
  JWT_SECRET,
  JWT_EXPIRY,
  ADMIN_REGISTRATION_KEY,
  PROVIDER_SERVICE_URL,
  USER_SERVICE_URL,
  CHARGER_SERVICE_URL,
  ANALYTICS_SERVICE_URL,
  AUTH_SERVICE_URL,
  RESERVATION_SERVICE_URL,
  PLUG_SERVICE_URL,
  BLUE_PLUG_ADAPTER_URL,
  RED_PLUG_ADAPTER_URL,
  GREEN_PLUG_ADAPTER_URL,
  BILLING_SERVICE_URL,
} = process.env;
