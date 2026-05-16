/**
 * Integration test runner.
 * Usage:  node tests/integration/run.js
 * Env:    GATEWAY_URL (default: http://localhost)
 *         GATEWAY_API_PREFIX (default: /api)
 *         BLUE_ADAPTER_URL / RED_ADAPTER_URL / GREEN_ADAPTER_URL
 *         Optional direct adapter URLs are intended for docker-compose.dev.yml.
 *
 * Requires Docker Compose stack to be running.
 */

import { run } from "node:test";
import { spec } from "node:test/reporters";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const dir = path.dirname(fileURLToPath(import.meta.url));

const files = readdirSync(dir)
  .filter(f => f.endsWith(".test.js"))
  .map(f => path.join(dir, f));

const stream = run({
  files,
  concurrency: false,   // run suites sequentially — services share state
  timeout: 30_000,
});

stream.compose(spec()).pipe(process.stdout);

stream.on("test:fail", () => { process.exitCode = 1; });
