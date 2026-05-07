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
  console.error("Error loading .env file:", result.error);
  console.error("Details:", result.error);
  process.exit(1);
}

console.log(".env file loaded successfully. PORT is:", process.env.PORT);

export const { PORT, RABBITMQ_URL, BLUE_PLUG_ADAPTER_URL, RED_PLUG_ADAPTER_URL, GREEN_PLUG_ADAPTER_URL } = process.env;
