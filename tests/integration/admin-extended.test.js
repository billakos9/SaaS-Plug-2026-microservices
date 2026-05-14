import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, assert, log } from "./helpers.js";

const RUN = Date.now();

const ADMIN = {
  firstName:       "Extended",
  lastName:        "Admin",
  email:           `extended_${RUN}@saas.com`,
  password:        "extpass456",
  registrationKey: "super_secret_admin_key",
};

let adminToken;
let adminId;

// ── Registration validation ────────────────────────────────────────────────

describe("admin-service — registration field validation", () => {

  it("rejects missing firstName", async () => {
    const { firstName: _, ...body } = ADMIN;
    const r = await req("POST", "/admin/register", body);
    log("register — no firstName", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing lastName", async () => {
    const { lastName: _, ...body } = ADMIN;
    const r = await req("POST", "/admin/register", body);
    log("register — no lastName", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing email", async () => {
    const { email: _, ...body } = ADMIN;
    const r = await req("POST", "/admin/register", body);
    log("register — no email", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing password", async () => {
    const { password: _, ...body } = ADMIN;
    const r = await req("POST", "/admin/register", body);
    log("register — no password", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects missing registrationKey", async () => {
    const { registrationKey: _, ...body } = ADMIN;
    const r = await req("POST", "/admin/register", body);
    log("register — no registrationKey", r);
    assertEqual(r.status, 400, "status");
  });

  it("registration response never exposes password", async () => {
    const r = await req("POST", "/admin/register", ADMIN);
    log("register — security", r);
    assertEqual(r.status, 201, "status");
    assertExists(r.body.adminId,   "adminId");
    assertExists(r.body.firstName, "firstName");
    assertExists(r.body.lastName,  "lastName");
    assertExists(r.body.email,     "email");
    if (r.body.password) throw new Error("password exposed in registration response");
    adminId = r.body.adminId;
  });
});

// ── Auth flows ─────────────────────────────────────────────────────────────

describe("admin-service — auth flows", () => {

  before(async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: ADMIN.password });
    adminToken = r.body.token;
  });

  it("login response contains adminId, email, firstName, lastName", async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: ADMIN.password });
    log("login — shape", r);
    assertEqual(r.status, 200, "status");
    assertExists(r.body.token,     "token");
    assertExists(r.body.adminId,   "adminId");
    assertExists(r.body.email,     "email");
    assertExists(r.body.firstName, "firstName");
    assertExists(r.body.lastName,  "lastName");
    if (r.body.password) throw new Error("password exposed in login response");
  });

  it("rejects login with empty password", async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: "" });
    log("login — empty password", r);
    assertEqual(r.status, 400, "status");
  });

  it("GET /admin/profile returns the current admin's data", async () => {
    const r = await req("GET", "/admin/profile", null, adminToken);
    log("profile", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.adminId,   adminId,        "adminId");
    assertEqual(r.body.email,     ADMIN.email,    "email");
    assertEqual(r.body.firstName, ADMIN.firstName, "firstName");
    if (r.body.password) throw new Error("password exposed in profile");
  });

  it("GET /admin/accounts returns an array including the registered admin", async () => {
    const r = await req("GET", "/admin/accounts", null, adminToken);
    log("accounts list", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    const found = r.body.find(a => a.adminId === adminId);
    if (!found) throw new Error("registered admin not found in accounts list");
  });
});

// ── Account update ─────────────────────────────────────────────────────────

describe("admin-service — account update", () => {

  before(async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: ADMIN.password });
    adminToken = r.body.token;
  });

  it("updates firstName and change is reflected in profile", async () => {
    const newFirst = `Updated_${RUN}`;
    const upd = await req("PUT", `/admin/accounts/${adminId}`, { firstName: newFirst }, adminToken);
    log("update firstName", upd);
    assertEqual(upd.status, 200, "update status");
    assertEqual(upd.body.firstName, newFirst, "firstName in update response");

    const profile = await req("GET", "/admin/profile", null, adminToken);
    assertEqual(profile.body.firstName, newFirst, "firstName in profile after update");
  });

  it("updates password and new password works for login", async () => {
    const newPw = `newPass_${RUN}`;
    await req("PUT", `/admin/accounts/${adminId}`, { password: newPw }, adminToken);

    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: newPw });
    log("login with new password", r);
    assertEqual(r.status, 200, "login with new password");
    assertExists(r.body.token, "token after password change");
    adminToken = r.body.token; // update token for subsequent tests
  });

  it("returns 404 when updating non-existent admin", async () => {
    const r = await req("PUT", "/admin/accounts/999999999", { firstName: "ghost" }, adminToken);
    log("update — not found", r);
    assertEqual(r.status, 404, "status");
  });
});

// ── Analytics ──────────────────────────────────────────────────────────────

describe("admin-service — analytics detail", () => {

  before(async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: ADMIN.password });
    if (r.body.token) adminToken = r.body.token;
    else {
      // password may have been changed above — try updated password
      const r2 = await req("POST", "/admin/login", { email: ADMIN.email, password: `newPass_${RUN}` });
      adminToken = r2.body.token;
    }
  });

  it("analytics generatedAt is a valid ISO timestamp", async () => {
    const r = await req("GET", "/admin/analytics", null, adminToken);
    assertEqual(r.status, 200, "status");
    if (isNaN(Date.parse(r.body.generatedAt)))
      throw new Error(`generatedAt is not a valid date: ${r.body.generatedAt}`);
  });

  it("analytics chargers.total is a non-negative number", async () => {
    const r = await req("GET", "/admin/analytics", null, adminToken);
    assertEqual(r.status, 200, "status");
    if (typeof r.body.chargers.total !== "number")
      throw new Error(`chargers.total must be a number, got ${typeof r.body.chargers.total}`);
    if (r.body.chargers.total < 0)
      throw new Error(`chargers.total must be non-negative, got ${r.body.chargers.total}`);
    log("analytics chargers.total", { count: r.body.chargers.total });
  });

  it("analytics chargers.byStatus only contains valid status keys", async () => {
    const r = await req("GET", "/admin/analytics", null, adminToken);
    assertEqual(r.status, 200, "status");
    const validStatuses = new Set(["available", "charging", "offline", "malfunction", "reserved"]);
    for (const key of Object.keys(r.body.chargers.byStatus)) {
      if (!validStatuses.has(key))
        throw new Error(`unexpected status key in byStatus: "${key}"`);
    }
  });

  it("GET /admin/analytics/providers returns breakdown array", async () => {
    const r = await req("GET", "/admin/analytics/providers", null, adminToken);
    log("analytics/providers", r);
    assertEqual(r.status, 200, "status");
    assertExists(r.body.generatedAt, "generatedAt");
    if (!Array.isArray(r.body.breakdown))
      throw new Error("breakdown must be an array");
  });

  it("GET /admin/analytics/providers — each entry has providerId, providerName, total", async () => {
    const r = await req("GET", "/admin/analytics/providers", null, adminToken);
    assertEqual(r.status, 200, "status");
    for (const entry of r.body.breakdown) {
      if (typeof entry.providerId   !== "number") throw new Error("providerId must be number");
      if (typeof entry.providerName !== "string") throw new Error("providerName must be string");
      if (typeof entry.total        !== "number") throw new Error("total must be number");
      if (typeof entry.byStatus     !== "object") throw new Error("byStatus must be object");
    }
  });
});

// ── Management proxy ───────────────────────────────────────────────────────

describe("admin-service — management proxy detail", () => {

  before(async () => {
    const r = await req("POST", "/admin/login", { email: ADMIN.email, password: ADMIN.password });
    if (r.body.token) adminToken = r.body.token;
    else {
      const r2 = await req("POST", "/admin/login", { email: ADMIN.email, password: `newPass_${RUN}` });
      adminToken = r2.body.token;
    }
  });

  it("GET /admin/chargers returns array of charger objects", async () => {
    const r = await req("GET", "/admin/chargers", null, adminToken);
    log("proxy — chargers", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    assert(r.body.length > 0, "should have chargers from plug-service sync");
  });

  it("GET /admin/chargers/status/available returns only available chargers", async () => {
    const r = await req("GET", "/admin/chargers/status/available", null, adminToken);
    log("proxy — chargers/available", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    for (const c of r.body) {
      if (c.status !== "available")
        throw new Error(`status filter leaked a "${c.status}" charger`);
    }
  });

  it("GET /admin/chargers/:id returns the correct charger", async () => {
    const BLUE_ID = 458729;
    const r = await req("GET", `/admin/chargers/${BLUE_ID}`, null, adminToken);
    log(`proxy — charger ${BLUE_ID}`, r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.id, BLUE_ID, "id");
    assertEqual(r.body.ProviderName, "bluePlug", "ProviderName");
  });

  it("GET /admin/providers returns array of providers", async () => {
    const r = await req("GET", "/admin/providers", null, adminToken);
    log("proxy — providers", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
  });

  it("POST /admin/providers registers a provider via proxy and it appears in list", async () => {
    const newProvider = {
      providerName: `proxyProv_${RUN}`,
      email:        `proxy_${RUN}@prov.com`,
      password:     "proxypw",
      apiBaseUrl:   `http://proxy-${RUN}:3000`,
      apiKey:       `proxy-key-${RUN}`,
    };
    const create = await req("POST", "/admin/providers", newProvider, adminToken);
    log("proxy — create provider", create);
    assertEqual(create.status, 201, "create status");
    assertExists(create.body.providerId, "providerId");

    const list = await req("GET", "/admin/providers", null, adminToken);
    const found = list.body.find(p => p.providerId === create.body.providerId);
    if (!found) throw new Error("proxy-created provider not in list");

    // cleanup
    await req("DELETE", `/providers/delete/${create.body.providerId}`);
  });

  it("requires auth — GET /admin/chargers without token returns 401", async () => {
    const r = await req("GET", "/admin/chargers");
    log("proxy — no token", r);
    assertEqual(r.status, 401, "status");
  });
});
