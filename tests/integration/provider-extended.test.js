import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, assert, log } from "./helpers.js";

// Unique suffix per run so repeated test runs don't collide
const RUN = Date.now();

const BASE_PROVIDER = {
  providerName: `extProvider_${RUN}`,
  email:        `ext_${RUN}@provider.com`,
  password:     "ext-pass-123",
  apiBaseUrl:   `http://ext-${RUN}-adapter:3000`,
  apiKey:       `key-${RUN}`,
};

let providerId;

// ── Field-level validation ─────────────────────────────────────────────────

describe("provider-service — input validation", () => {

  it("rejects missing providerName", async () => {
    const { providerName: _, ...body } = BASE_PROVIDER;
    const r = await req("POST", "/providers/register", body);
    log("register — no providerName", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing email", async () => {
    const { email: _, ...body } = BASE_PROVIDER;
    const r = await req("POST", "/providers/register", body);
    log("register — no email", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing password", async () => {
    const { password: _, ...body } = BASE_PROVIDER;
    const r = await req("POST", "/providers/register", body);
    log("register — no password", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing apiBaseUrl", async () => {
    const { apiBaseUrl: _, ...body } = BASE_PROVIDER;
    const r = await req("POST", "/providers/register", body);
    log("register — no apiBaseUrl", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing apiKey", async () => {
    const { apiKey: _, ...body } = BASE_PROVIDER;
    const r = await req("POST", "/providers/register", body);
    log("register — no apiKey", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects empty-string providerName", async () => {
    const r = await req("POST", "/providers/register", { ...BASE_PROVIDER, providerName: "   " });
    log("register — blank providerName", r);
    assertEqual(r.status, 400, "status");
  });
});

// ── Security: no secrets in responses ─────────────────────────────────────

describe("provider-service — response security", () => {

  before(async () => {
    const r = await req("POST", "/providers/register", BASE_PROVIDER);
    providerId = r.body.providerId;
  });

  it("registration response never exposes password", async () => {
    const r = await req("POST", "/providers/register", {
      ...BASE_PROVIDER,
      providerName: `sec_${RUN}`,
      email: `sec_${RUN}@provider.com`,
    });
    log("register — security check", r);
    assertEqual(r.status, 201, "status");
    if (r.body.password) throw new Error("password exposed in registration response");
    if (r.body.apiKey)   throw new Error("apiKey exposed in registration response");
  });

  it("list response never exposes password or apiKey", async () => {
    const r = await req("GET", "/providers/");
    log("list — security check", r);
    assertEqual(r.status, 200, "status");
    for (const p of r.body) {
      if (p.password) throw new Error(`password exposed for providerId ${p.providerId}`);
      if (p.apiKey)   throw new Error(`apiKey exposed for providerId ${p.providerId}`);
    }
  });

  it("get-by-id response includes public fields", async () => {
    const r = await req("GET", `/providers/${providerId}`);
    log("get by id — shape", r);
    assertEqual(r.status, 200, "status");
    assertExists(r.body.providerId,   "providerId");
    assertExists(r.body.providerName, "providerName");
    assertExists(r.body.apiBaseUrl,   "apiBaseUrl");
  });

  it("providerId is a positive number", async () => {
    const r = await req("GET", `/providers/${providerId}`);
    if (typeof r.body.providerId !== "number" || r.body.providerId < 1)
      throw new Error(`providerId must be a positive number, got ${r.body.providerId}`);
  });
});

// ── Update ─────────────────────────────────────────────────────────────────

describe("provider-service — update behaviour", () => {

  it("updates only apiBaseUrl, leaving other fields unchanged", async () => {
    const newUrl = `http://updated-${RUN}.example.com`;
    const r = await req("PUT", `/providers/update/${providerId}`, { apiBaseUrl: newUrl });
    log("update — apiBaseUrl only", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.apiBaseUrl, newUrl, "apiBaseUrl");
    assertEqual(r.body.providerName, BASE_PROVIDER.providerName, "providerName unchanged");
  });

  it("updates only providerName", async () => {
    const newName = `renamed_${RUN}`;
    const r = await req("PUT", `/providers/update/${providerId}`, { providerName: newName });
    log("update — providerName only", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.providerName, newName, "providerName");
  });

  it("returns 404 when updating a non-existent provider", async () => {
    const r = await req("PUT", "/providers/update/999999999", { apiBaseUrl: "http://x.com" });
    log("update — not found", r);
    assertEqual(r.status, 404, "status");
  });

  it("update response has a timestamp field", async () => {
    const r = await req("PUT", `/providers/update/${providerId}`, { apiBaseUrl: "http://ts-check.com" });
    log("update — timestamp", r);
    assertEqual(r.status, 200, "status");
    assertExists(r.body.timestamp, "timestamp");
    if (isNaN(Date.parse(r.body.timestamp)))
      throw new Error(`timestamp is not a valid date: ${r.body.timestamp}`);
  });
});

// ── Delete ─────────────────────────────────────────────────────────────────

describe("provider-service — delete behaviour", () => {

  it("returns 404 when deleting a non-existent provider", async () => {
    const r = await req("DELETE", "/providers/delete/999999999");
    log("delete — not found", r);
    assertEqual(r.status, 404, "status");
  });

  it("successive registrations receive unique, incrementing IDs", async () => {
    const r1 = await req("POST", "/providers/register", { ...BASE_PROVIDER, providerName: `seq_a_${RUN}`, email: `seq_a_${RUN}@p.com` });
    const r2 = await req("POST", "/providers/register", { ...BASE_PROVIDER, providerName: `seq_b_${RUN}`, email: `seq_b_${RUN}@p.com` });
    assertEqual(r1.status, 201, "r1 status");
    assertEqual(r2.status, 201, "r2 status");
    assert(r2.body.providerId > r1.body.providerId, "IDs should be strictly increasing");
    // cleanup
    await req("DELETE", `/providers/delete/${r1.body.providerId}`);
    await req("DELETE", `/providers/delete/${r2.body.providerId}`);
  });
});
