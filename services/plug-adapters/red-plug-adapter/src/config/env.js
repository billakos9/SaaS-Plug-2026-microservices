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

/**
 * Environment variables used by the redPlug adapter.
 */
export const {
  PORT,
  RED_PLUG_BASE_URL,
  RED_PLUG_AUTH_TOKEN,
} = process.env;
