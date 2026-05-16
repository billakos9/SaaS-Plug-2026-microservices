import { createHmac } from "node:crypto";

export const BASE_URL = process.env.GATEWAY_URL ?? "http://localhost";

export async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

export function assertEqual(actual, expected, label) {
  if (actual !== expected)
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export function assertExists(value, label) {
  if (value === undefined || value === null)
    throw new Error(`${label}: expected a value, got ${JSON.stringify(value)}`);
}

function getJwtSecret(secret) {
  const jwtSecret = secret ?? process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required to mint integration test tokens");
  }

  return jwtSecret;
}

// Manually mint a user JWT using the same algorithm as jsonwebtoken (HS256)
// so we can test reservation-service without a running user-service.
export function mintUserToken(userId, secret) {
  const jwtSecret = getJwtSecret(secret);
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ userId, email: `user${userId}@test.com`, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400 })).toString("base64url");
  const sig = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function mintProviderToken(providerName, secret) {
  const jwtSecret = getJwtSecret(secret);
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ userId: 0, role: "provider", providerName, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400 })).toString("base64url");
  const sig = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function log(label, obj) {
  const color = obj?.status >= 400 ? "\x1b[31m" : "\x1b[32m";
  console.log(`  ${color}[${obj?.status ?? ""}]\x1b[0m ${label}`);
}
