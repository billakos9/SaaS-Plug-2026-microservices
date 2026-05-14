import { describe, it, before, after } from "node:test";
import { req, assertEqual, assertExists, log } from "./helpers.js";

const PROVIDER = {
  providerName: "testProvider",
  email:        "test@provider.com",
  password:     "pass1234",
  apiBaseUrl:   "http://test-adapter:3000",
  apiKey:       "test-api-key",
};

let providerId;

describe("provider-service", () => {

  it("rejects registration with missing fields", async () => {
    const r = await req("POST", "/providers/register", { providerName: "only-name" });
    log("register — missing fields", r);
    assertEqual(r.status, 400, "status");
  });

  it("registers a new provider", async () => {
    const r = await req("POST", "/providers/register", PROVIDER);
    log("register — success", r);
    assertEqual(r.status, 201, "status");
    assertExists(r.body.providerId, "providerId");
    assertExists(r.body.providerName, "providerName");
    assertEqual(r.body.providerName, PROVIDER.providerName, "providerName value");
    // password and apiKey must NOT be in the response
    if (r.body.password) throw new Error("password leaked in response");
    if (r.body.apiKey)   throw new Error("apiKey leaked in response");
    providerId = r.body.providerId;
  });

  it("allows duplicate provider name (no uniqueness enforced on providerName)", async () => {
    const r = await req("POST", "/providers/register", PROVIDER);
    log("register — duplicate providerName", r);
    // providerName has no unique index; each call gets a new providerId
    assertEqual(r.status, 201, "status");
  });

  it("lists all providers", async () => {
    const r = await req("GET", "/providers/");
    log("list all", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    const found = r.body.find(p => p.providerId === providerId);
    if (!found) throw new Error("registered provider not in list");
  });

  it("gets provider by id", async () => {
    const r = await req("GET", `/providers/${providerId}`);
    log("get by id", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.providerId, providerId, "providerId");
  });

  it("returns 404 for unknown provider id", async () => {
    const r = await req("GET", "/providers/999999");
    log("get by id — not found", r);
    assertEqual(r.status, 404, "status");
  });

  it("updates provider apiBaseUrl", async () => {
    const r = await req("PUT", `/providers/update/${providerId}`, { apiBaseUrl: "http://updated-adapter:3000" });
    log("update", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.apiBaseUrl, "http://updated-adapter:3000", "apiBaseUrl");
  });

  it("deletes provider", async () => {
    const r = await req("DELETE", `/providers/delete/${providerId}`);
    log("delete", r);
    assertEqual(r.status, 200, "status");
  });

  it("returns 404 after deletion", async () => {
    const r = await req("GET", `/providers/${providerId}`);
    log("get after delete — not found", r);
    assertEqual(r.status, 404, "status");
  });
});
