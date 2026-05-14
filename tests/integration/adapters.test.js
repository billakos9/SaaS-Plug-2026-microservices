import { describe, it, before } from "node:test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { req, assertEqual, assertExists, log } from "./helpers.js";

const execAsync = promisify(exec);

// Adapters are called directly on their own ports, not through nginx
const BLUE  = process.env.BLUE_ADAPTER_URL  ?? "http://localhost:3009";
const RED   = process.env.RED_ADAPTER_URL   ?? "http://localhost:3010";
const GREEN = process.env.GREEN_ADAPTER_URL ?? "http://localhost:3011";

const VALID_STATUSES = new Set(["available", "charging", "offline", "malfunction", "reserved"]);

// Chargers reserved exclusively for ntua-reservation-e2e.test.js — never use them in adapter tests
const E2E_CHARGER_ID       = 458729; // bluePlug
const E2E_RED_CHARGER_ID   = 458664; // redPlug
const E2E_GREEN_CHARGER_ID = 458728; // greenPlug

async function adapterReq(baseUrl, path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

for (const [name, base, prefix] of [
  ["bluePlug",  BLUE,  "/bluePlugAdapter"],
  ["redPlug",   RED,   "/redPlugAdapter"],
  ["greenPlug", GREEN, "/greenPlugAdapter"],
]) {
  describe(`${name} adapter`, () => {

    it("health-check — service is reachable", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      log(`${name} GET /fetchPoints`, r);
      if (r.status === 0 || r.status === undefined)
        throw new Error(`${name} adapter not reachable`);
    });

    it("returns array of charger points from /fetchPoints", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      log(`${name} charger list`, r);
      assertEqual(r.status, 200, "status");
      if (!Array.isArray(r.body))
        throw new Error(`expected array, got ${typeof r.body}`);
    });

    it("returns non-empty array — NTUA data has been synced", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      assertEqual(r.status, 200, "status");
      if (!Array.isArray(r.body) || r.body.length === 0)
        throw new Error(`expected non-empty array, got ${r.body?.length ?? "non-array"}`);
      log(`${name} charger count`, { count: r.body.length });
    });

    it("charger objects have required fields", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      assertEqual(r.status, 200, "status");
      const sample = r.body.slice(0, 5);
      for (const charger of sample) {
        if (typeof charger.id !== "number")
          throw new Error(`id must be a number, got ${typeof charger.id} (value: ${charger.id})`);
        if (typeof charger.ProviderName !== "string" || !charger.ProviderName)
          throw new Error(`ProviderName must be a non-empty string`);
        if (typeof charger.status !== "string")
          throw new Error(`status must be a string`);
        if (typeof charger.address !== "string")
          throw new Error(`address must be a string`);
      }
    });

    it("ProviderName matches the adapter identity", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      assertEqual(r.status, 200, "status");
      for (const charger of r.body) {
        if (charger.ProviderName !== name)
          throw new Error(`expected ProviderName "${name}", got "${charger.ProviderName}"`);
      }
    });

    it("all charger statuses are valid enum values", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      assertEqual(r.status, 200, "status");
      const invalid = r.body.filter(c => !VALID_STATUSES.has(c.status));
      if (invalid.length > 0)
        throw new Error(`${invalid.length} chargers have invalid status: ${[...new Set(invalid.map(c => c.status))].join(", ")}`);
    });

    it("cap and kwhPrice are non-negative numbers", async () => {
      const r = await adapterReq(base, `${prefix}/fetchPoints`);
      assertEqual(r.status, 200, "status");
      for (const charger of r.body.slice(0, 20)) {
        if (charger.cap !== undefined && (typeof charger.cap !== "number" || charger.cap < 0))
          throw new Error(`cap must be a non-negative number, got ${charger.cap}`);
        if (charger.kwhPrice !== undefined && (typeof charger.kwhPrice !== "number" || charger.kwhPrice < 0))
          throw new Error(`kwhPrice must be a non-negative number, got ${charger.kwhPrice}`);
      }
    });

    it("postReservations route exists and rejects missing body gracefully", async () => {
      const r = await adapterReq(base, `${prefix}/postReservations`, "POST", {});
      log(`${name} POST /postReservations empty body`, r);
      // should return 400/404/500 — anything but a network failure or nginx 502
      if (r.status === 0 || r.status === undefined)
        throw new Error("endpoint not reachable");
      if (r.status === 502)
        throw new Error("nginx upstream error — service may be down");
    });

    it("unmatched route returns 404 not 500", async () => {
      const r = await adapterReq(base, "/nonexistent-path");
      log(`${name} unmatched route`, r);
      assertEqual(r.status, 404, "status");
    });

    it("postReservations with valid chargerId returns 200 and marks charger reserved in adapter DB", async () => {
      const fetchR = await adapterReq(base, `${prefix}/fetchPoints`);
      if (!Array.isArray(fetchR.body) || fetchR.body.length === 0)
        throw new Error("fetchPoints returned no chargers — sync may not have run yet");

      // Exclude the charger reserved for the ntua e2e test to avoid cross-test pollution
      const available = fetchR.body.find(c => c.status === "available" && c.id !== E2E_CHARGER_ID);
      if (!available) {
        // All non-e2e chargers currently reserved (within hold window) — skip gracefully
        log(`${name} postReservations skip — no available charger`, { status: 0 });
        return;
      }

      const r = await adapterReq(base, `${prefix}/postReservations`, "POST", {
        chargerId: available.id,
        minutes:   15,
      });
      log(`${name} POST /postReservations valid charger`, r);
      if (r.status === 429) {
        // NTUA API rate-limited — skip gracefully, not a service bug
        log(`${name} postReservations skip — rate limited (429)`, { status: 429 });
        return;
      }
      assertEqual(r.status, 200, "reservation http status");

      // Adapter local DB must immediately reflect "reserved"
      const fetchAfter = await adapterReq(base, `${prefix}/fetchPoints`);
      const chargerAfter = fetchAfter.body.find(c => c.id === available.id);
      assertExists(chargerAfter, `charger ${available.id} still in fetchPoints after reservation`);
      assertEqual(chargerAfter.status, "reserved", "adapter local DB status after postReservations");
    });
  });
}

// ── Sync loop → charger.update event → charger-service propagation ─────────
//
// These tests verify the adapter sync-loop behaviour: when the sync loop
// detects that a charger's NTUA status differs from its local DB, it publishes
// a charger.update event that charger-service consumes to update its own DB.
//
// Strategy: artificially create a mismatch by patching the adapter's MongoDB
// directly, then wait one full sync cycle (60 s) and confirm charger-service
// converges to what NTUA reports.

describe("blue-plug adapter — sync loop publishes charger.update to charger-service", () => {

  const DB_CONTAINER  = "bluePlug_db";
  const DB_NAME       = "blueplug";
  const COLLECTION    = "chargerpoints";
  const PROVIDER      = "bluePlug";

  let testChargerId;  // picked dynamically — never the e2e-reserved charger
  let ntuaStatus;     // what NTUA / adapter DB currently report

  before(async () => {
    // Ensure the charger is in charger-service DB at a KNOWN status first
    const r = await adapterReq(BLUE, "/bluePlugAdapter/fetchPoints");
    if (!Array.isArray(r.body) || r.body.length === 0)
      throw new Error("fetchPoints returned no chargers — sync may not have run");

    // Pick any charger that is NOT the e2e-reserved one
    const charger = r.body.find(c => c.id !== E2E_CHARGER_ID);
    if (!charger) throw new Error("no usable charger found in blue adapter (all are e2e-reserved?)");

    testChargerId = charger.id;
    ntuaStatus = charger.status;

    // Sync charger-service to match so the test starts from a consistent state
    await req("POST", "/chargers/", { id: testChargerId, ProviderName: PROVIDER, status: ntuaStatus });
  });

  it("artificially mismatches adapter local DB then waits for sync to correct charger-service", { timeout: 90_000 }, async () => {
    // Pick the opposite status so the sync loop detects a change
    const fakeStatus = ntuaStatus === "available" ? "offline" : "available";

    // Patch the adapter's MongoDB directly to create the mismatch
    const mongoshCmd =
      `docker exec ${DB_CONTAINER} mongosh --quiet ${DB_NAME} ` +
      `--eval 'db.${COLLECTION}.updateOne({id:${testChargerId}},{$set:{status:"${fakeStatus}"}})'`;
    await execAsync(mongoshCmd);

    // Confirm the patch landed
    const patchedR = await adapterReq(BLUE, "/bluePlugAdapter/fetchPoints");
    const patched = patchedR.body.find(c => c.id === testChargerId);
    assertEqual(patched?.status, fakeStatus, "adapter local DB reflects patched status");

    // Set charger-service to the same fake status so we can observe the correction
    await req("POST", "/chargers/", { id: testChargerId, ProviderName: PROVIDER, status: fakeStatus });

    log("sync test — waiting 65 s for adapter sync cycle", { status: 0 });
    await new Promise(r => setTimeout(r, 65_000));

    // After one sync cycle the adapter should have detected: local="fakeStatus", NTUA="ntuaStatus"
    // → published charger.update with status=ntuaStatus → charger-service updated
    const chargerR = await req("GET", `/chargers/id/${testChargerId}`);
    log("charger-service status after sync cycle", chargerR);
    assertEqual(chargerR.status, 200, "charger-service GET status");
    assertEqual(chargerR.body.status, ntuaStatus, "charger-service converged to NTUA status via charger.update event");
  });
});

describe("red-plug adapter — sync loop publishes charger.update to charger-service", () => {

  const DB_CONTAINER = "redPlug_db";
  const DB_NAME      = "redplug";
  const COLLECTION   = "chargerpoints";
  const PROVIDER     = "redPlug";

  let testChargerId;
  let ntuaStatus;

  before(async () => {
    const r = await adapterReq(RED, "/redPlugAdapter/fetchPoints");
    if (!Array.isArray(r.body) || r.body.length === 0)
      throw new Error("fetchPoints returned no chargers — sync may not have run");

    const charger = r.body.find(c => c.id !== E2E_RED_CHARGER_ID);
    if (!charger) throw new Error("no usable charger found in red adapter");

    testChargerId = charger.id;
    ntuaStatus    = charger.status;

    await req("POST", "/chargers/", { id: testChargerId, ProviderName: PROVIDER, status: ntuaStatus });
  });

  it("artificially mismatches adapter local DB then waits for sync to correct charger-service", { timeout: 90_000 }, async () => {
    const fakeStatus = ntuaStatus === "available" ? "offline" : "available";

    const mongoshCmd =
      `docker exec ${DB_CONTAINER} mongosh --quiet ${DB_NAME} ` +
      `--eval 'db.${COLLECTION}.updateOne({id:${testChargerId}},{$set:{status:"${fakeStatus}"}})'`;
    await execAsync(mongoshCmd);

    const patchedR = await adapterReq(RED, "/redPlugAdapter/fetchPoints");
    const patched  = patchedR.body.find(c => c.id === testChargerId);
    assertEqual(patched?.status, fakeStatus, "adapter local DB reflects patched status");

    await req("POST", "/chargers/", { id: testChargerId, ProviderName: PROVIDER, status: fakeStatus });

    log("sync test (red) — waiting 65 s for adapter sync cycle", { status: 0 });
    await new Promise(r => setTimeout(r, 65_000));

    const chargerR = await req("GET", `/chargers/id/${testChargerId}`);
    log("charger-service status after red sync cycle", chargerR);
    assertEqual(chargerR.status, 200, "charger-service GET status");
    assertEqual(chargerR.body.status, ntuaStatus, "charger-service converged to NTUA status via charger.update event");
  });
});

describe("green-plug adapter — sync loop publishes charger.update to charger-service", () => {

  const DB_CONTAINER = "greenPlug_db";
  const DB_NAME      = "greenplug";
  const COLLECTION   = "chargerpoints";
  const PROVIDER     = "greenPlug";

  let testChargerId;
  let ntuaStatus;

  before(async () => {
    const r = await adapterReq(GREEN, "/greenPlugAdapter/fetchPoints");
    if (!Array.isArray(r.body) || r.body.length === 0)
      throw new Error("fetchPoints returned no chargers — sync may not have run");

    const charger = r.body.find(c => c.id !== E2E_GREEN_CHARGER_ID);
    if (!charger) throw new Error("no usable charger found in green adapter");

    testChargerId = charger.id;
    ntuaStatus    = charger.status;

    await req("POST", "/chargers/", { id: testChargerId, ProviderName: PROVIDER, status: ntuaStatus });
  });

  it("artificially mismatches adapter local DB then waits for sync to correct charger-service", { timeout: 90_000 }, async () => {
    const fakeStatus = ntuaStatus === "available" ? "offline" : "available";

    const mongoshCmd =
      `docker exec ${DB_CONTAINER} mongosh --quiet ${DB_NAME} ` +
      `--eval 'db.${COLLECTION}.updateOne({id:${testChargerId}},{$set:{status:"${fakeStatus}"}})'`;
    await execAsync(mongoshCmd);

    const patchedR = await adapterReq(GREEN, "/greenPlugAdapter/fetchPoints");
    const patched  = patchedR.body.find(c => c.id === testChargerId);
    assertEqual(patched?.status, fakeStatus, "adapter local DB reflects patched status");

    await req("POST", "/chargers/", { id: testChargerId, ProviderName: PROVIDER, status: fakeStatus });

    log("sync test (green) — waiting 65 s for adapter sync cycle", { status: 0 });
    await new Promise(r => setTimeout(r, 65_000));

    const chargerR = await req("GET", `/chargers/id/${testChargerId}`);
    log("charger-service status after green sync cycle", chargerR);
    assertEqual(chargerR.status, 200, "charger-service GET status");
    assertEqual(chargerR.body.status, ntuaStatus, "charger-service converged to NTUA status via charger.update event");
  });
});
