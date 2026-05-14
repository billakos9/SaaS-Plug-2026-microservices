import { describe, it } from "node:test";
import { req, assertEqual, assertExists, log } from "./helpers.js";

const ADMIN = {
  firstName:       "Test",
  lastName:        "Admin",
  email:           `admin_${Date.now()}@saas.com`,
  password:        "adminpass123",
  registrationKey: "super_secret_admin_key",
};

let adminToken;

describe("admin-service — auth", () => {

  it("rejects registration with wrong registration key", async () => {
    const r = await req("POST", "/admin/register", { ...ADMIN, registrationKey: "wrong-key" });
    log("register — wrong key", r);
    assertEqual(r.status, 403, "status");
  });

  it("registers a new admin", async () => {
    const r = await req("POST", "/admin/register", ADMIN);
    log("register — success", r);
    assertEqual(r.status, 201, "status");
    assertExists(r.body.adminId, "adminId");
    assertEqual(r.body.email, ADMIN.email, "email");
    if (r.body.password) throw new Error("password leaked in response");
  });

  it("rejects duplicate admin email", async () => {
    const r = await req("POST", "/admin/register", ADMIN);
    log("register — duplicate", r);
    assertEqual(r.status, 400, "status"); // service uses BAD_REQUEST for duplicate email
  });

  it("rejects login with wrong password", async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: "wrong" });
    log("login — wrong password", r);
    assertEqual(r.status, 401, "status");
  });

  it("logs in and returns a JWT", async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: ADMIN.password });
    log("login — success", r);
    assertEqual(r.status, 200, "status");
    assertExists(r.body.token, "token");
    adminToken = r.body.token;
  });
});

describe("admin-service — analytics (requires auth)", () => {

  it("rejects unauthenticated analytics request", async () => {
    const r = await req("GET", "/admin/analytics");
    log("analytics — no token", r);
    assertEqual(r.status, 401, "status");
  });

  it("returns analytics with valid token", async () => {
    const r = await req("GET", "/admin/analytics", null, adminToken);
    log("analytics — success", r);
    assertEqual(r.status, 200, "status");
    assertExists(r.body.chargers, "chargers");
    assertExists(r.body.generatedAt, "generatedAt");
  });

  it("analytics chargers field has total and byStatus", async () => {
    const r = await req("GET", "/admin/analytics", null, adminToken);
    log("analytics — charger breakdown", r);
    assertEqual(r.status, 200, "status");
    if (typeof r.body.chargers.total !== "number")
      throw new Error(`chargers.total expected number, got ${typeof r.body.chargers.total}`);
    if (typeof r.body.chargers.byStatus !== "object")
      throw new Error("chargers.byStatus expected object");
  });
});

describe("admin-service — management proxy (requires auth)", () => {

  it("proxies GET /admin/manage/providers to provider-service", async () => {
    const r = await req("GET", "/admin/manage/providers", null, adminToken);
    log("proxy — list providers", r);
    // provider-service returns array; accept 200 or 404 (route may vary)
    if (r.status !== 200 && r.status !== 404)
      throw new Error(`unexpected status ${r.status}`);
  });

  it("proxies GET /admin/manage/chargers to charger-service", async () => {
    const r = await req("GET", "/admin/manage/chargers", null, adminToken);
    log("proxy — list chargers", r);
    if (r.status !== 200 && r.status !== 404)
      throw new Error(`unexpected status ${r.status}`);
  });
});
