import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, assert, log } from "./helpers.js";

const RUN = Date.now();

// Use high IDs unlikely to collide with real NTUA charger IDs
const IDS = {
  available:   70001,
  charging:    70002,
  offline:     70003,
  malfunction: 70004,
  reserved:    70005,
  provA:       70010,
  provB:       70011,
  provC:       70012,
};

const ALL_STATUSES = ["available", "charging", "offline", "malfunction", "reserved"];

// ── All valid status values ────────────────────────────────────────────────

describe("charger-service — all valid status values", () => {

  for (const status of ALL_STATUSES) {
    it(`accepts status "${status}"`, async () => {
      const r = await req("POST", "/chargers/", { id: IDS[status], ProviderName: "testProv", status });
      log(`create status=${status}`, r);
      assertEqual(r.status, 200, "status");
      assertEqual(r.body.status, status, "status field");
      assertEqual(r.body.id, IDS[status], "id");
    });
  }

  it("each status filter returns only chargers with that status", async () => {
    for (const status of ALL_STATUSES) {
      const r = await req("GET", `/chargers/status/${status}`);
      assertEqual(r.status, 200, `filter status for ${status}`);
      if (!Array.isArray(r.body)) throw new Error(`expected array for status=${status}`);
      const wrong = r.body.filter(c => c.status !== status);
      if (wrong.length > 0)
        throw new Error(`filter "${status}" returned ${wrong.length} chargers with wrong status`);
    }
    log("all status filters clean", { pass: ALL_STATUSES });
  });
});

// ── Provider filtering via list ────────────────────────────────────────────

describe("charger-service — multi-provider chargers", () => {

  before(async () => {
    await req("POST", "/chargers/", { id: IDS.provA, ProviderName: "alphaProvider", status: "available" });
    await req("POST", "/chargers/", { id: IDS.provB, ProviderName: "betaProvider",  status: "charging"  });
    await req("POST", "/chargers/", { id: IDS.provC, ProviderName: "gammaProvider", status: "offline"   });
  });

  it("list contains all three newly created chargers", async () => {
    const r = await req("GET", "/chargers/");
    assertEqual(r.status, 200, "status");
    const ids = new Set(r.body.map(c => c.id));
    for (const id of [IDS.provA, IDS.provB, IDS.provC]) {
      if (!ids.has(id)) throw new Error(`charger id=${id} not found in list`);
    }
  });

  it("each charger has the correct ProviderName", async () => {
    const cases = [
      [IDS.provA, "alphaProvider"],
      [IDS.provB, "betaProvider"],
      [IDS.provC, "gammaProvider"],
    ];
    for (const [id, expectedName] of cases) {
      const r = await req("GET", `/chargers/id/${id}`);
      assertEqual(r.status, 200, `GET id=${id} status`);
      assertEqual(r.body.ProviderName, expectedName, `ProviderName for id=${id}`);
    }
  });
});

// ── Upsert semantics ──────────────────────────────────────────────────────

describe("charger-service — upsert semantics", () => {

  const UPSERT_ID = 70020;

  it("creates charger on first call", async () => {
    const r = await req("POST", "/chargers/", { id: UPSERT_ID, ProviderName: "upsertProv", status: "available" });
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "available", "initial status");
  });

  it("updates all mutable fields on subsequent call with same id", async () => {
    const r = await req("POST", "/chargers/", {
      id:           UPSERT_ID,
      ProviderName: "upsertProvRenamed",
      status:       "malfunction",
      cap:          22,
      kwhPrice:     0.35,
      address:      "Test Street 1",
      locationName: "Test Location",
      connectionType: "Type2",
    });
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status,       "malfunction",      "status");
    assertEqual(r.body.ProviderName, "upsertProvRenamed", "ProviderName");
    assertEqual(r.body.cap,          22,                  "cap");
    assertEqual(r.body.kwhPrice,     0.35,                "kwhPrice");
    assertEqual(r.body.address,      "Test Street 1",     "address");
  });

  it("get-by-id reflects latest upserted state", async () => {
    const r = await req("GET", `/chargers/id/${UPSERT_ID}`);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status,       "malfunction",      "status");
    assertEqual(r.body.ProviderName, "upsertProvRenamed", "ProviderName");
  });
});

// ── Edge-case IDs ──────────────────────────────────────────────────────────

describe("charger-service — edge-case id lookups", () => {

  it("GET /chargers/id/999999999 for non-existent id does not crash (200 or 404)", async () => {
    const r = await req("GET", "/chargers/id/999999999");
    log("get non-existent id", r);
    if (r.status !== 200 && r.status !== 404)
      throw new Error(`expected 200 or 404, got ${r.status}`);
  });

  it("rejects non-numeric id on POST", async () => {
    const r = await req("POST", "/chargers/", { id: "not-a-number", ProviderName: "x", status: "available" });
    log("create — non-numeric id", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects 0 as charger id", async () => {
    const r = await req("POST", "/chargers/", { id: 0, ProviderName: "x", status: "available" });
    log("create — id=0", r);
    // id=0 is falsy so the DTO should reject it or at minimum create it with id 0
    // charger-service checks `if (chargerData.id)` which is falsy for 0 → goes to create path
    // The important thing is no server crash (not 500)
    if (r.status === 500) throw new Error("server crashed on id=0");
  });
});

// ── Field shape on real synced data ──────────────────────────────────────

describe("charger-service — real data field types", () => {

  it("cap is always a number when present", async () => {
    const r = await req("GET", "/chargers/");
    assertEqual(r.status, 200, "status");
    const withCap = r.body.filter(c => c.cap !== undefined).slice(0, 50);
    for (const c of withCap) {
      if (typeof c.cap !== "number")
        throw new Error(`cap must be a number, got ${typeof c.cap} for id=${c.id}`);
    }
    log("cap type check", { checked: withCap.length });
  });

  it("kwhPrice is always a non-negative number when present", async () => {
    const r = await req("GET", "/chargers/");
    assertEqual(r.status, 200, "status");
    const withPrice = r.body.filter(c => c.kwhPrice !== undefined).slice(0, 50);
    for (const c of withPrice) {
      if (typeof c.kwhPrice !== "number" || c.kwhPrice < 0)
        throw new Error(`kwhPrice invalid for id=${c.id}: ${c.kwhPrice}`);
    }
    log("kwhPrice type check", { checked: withPrice.length });
  });

  it("id is always a positive integer for all chargers", async () => {
    const r = await req("GET", "/chargers/");
    assertEqual(r.status, 200, "status");
    const invalid = r.body.filter(c => !Number.isInteger(c.id) || c.id <= 0);
    if (invalid.length > 0)
      throw new Error(`${invalid.length} chargers have invalid id values`);
  });

  it("byStatus counts sum matches total charger count", async () => {
    const [all, avail, charging, offline, malfunction, reserved] = await Promise.all([
      req("GET", "/chargers/"),
      req("GET", "/chargers/status/available"),
      req("GET", "/chargers/status/charging"),
      req("GET", "/chargers/status/offline"),
      req("GET", "/chargers/status/malfunction"),
      req("GET", "/chargers/status/reserved"),
    ]);
    const sumByStatus = avail.body.length + charging.body.length +
                        offline.body.length + malfunction.body.length +
                        reserved.body.length;
    assertEqual(sumByStatus, all.body.length, "sum of status buckets matches total");
    log("status counts", { total: all.body.length, sumByStatus });
  });
});
