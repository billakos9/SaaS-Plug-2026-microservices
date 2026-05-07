import { config } from "dotenv";
import { existsSync } from "node:fs";

const runtimeEnv = process.env.NODE_ENV ||
"development";
const envPath = `.env.development.local`;

console.log(`Attempting to load environment
    file from: ${envPath}`);
let result = config({ path: envPath });

if (result.error && runtimeEnv === 
    "production" && existsSync(envPath))
    {
        console.warn(`Production env file not found.
            Falling back to: ${envPath}`);
        result = config({ path: envPath });
    }

if (result.error) {
    console.error("Error loading .env file:",
        result.error
    );
    process.exit(1);
}

console.log(".env file loaded succesfully. Port is:",
    process.env.PORT);

export const {
    PORT,
    MONGOOSE_URL,
    RABBITMQ_URL,
    JWT_SECRET
} = process.env;
