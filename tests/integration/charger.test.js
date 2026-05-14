import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, log } from "./helpers.js";

const CHARGER = { id: 9001, ProviderName: "testProvider", status: "available" };

describe("charger-service", () => {

  it("rejects charger with missing id", async () => {
    const r = await req("POST", "/chargers/", { ProviderName: "x", status: "available" });
    log("create — missing id", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects charger with invalid status", async () => {
    const r = await req("POST", "/chargers/", { id: 9002, ProviderName: "x", status: "flying" });
    log("create — invalid status", r);
    assertEqual(r.status, 400, "status");
  });

  it("creates a charger", async () => {
    const r = await req("POST", "/chargers/", CHARGER);
    log("create — success", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.id, CHARGER.id, "id");
    assertEqual(r.body.status, "available", "status");
  });

  it("idempotent create — updates if id already exists", async () => {
    const r = await req("POST", "/chargers/", { ...CHARGER, status: "charging" });
    log("create — upsert existing", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "charging", "status after upsert");
  });

  it("lists all chargers", async () => {
    const r = await req("GET", "/chargers/");
    log("list all", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    const found = r.body.find(c => c.id === CHARGER.id);
    if (!found) throw new Error("created charger not in list");
  });

  it("gets charger by id", async () => {
    const r = await req("GET", `/chargers/id/${CHARGER.id}`);
    log("get by id", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.id, CHARGER.id, "id");
  });

  it("filters chargers by status", async () => {
    // reset to known status first
    await req("POST", "/chargers/", { ...CHARGER, status: "available" });
    const r = await req("GET", "/chargers/status/available");
    log("filter by status=available", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    const found = r.body.find(c => c.id === CHARGER.id);
    if (!found) throw new Error("charger not found in status filter");
    r.body.forEach(c => {
      if (c.status !== "available")
        throw new Error(`unexpected status ${c.status} in available filter`);
    });
  });

  it("returns 400 for invalid status filter", async () => {
    const r = await req("GET", "/chargers/status/nonexistent");
    log("filter — invalid status", r);
    assertEqual(r.status, 400, "status");
  });
});

// These tests rely on plug-service having already polled all three adapters.
// Adapter databases are populated from the NTUA API (~486 blue + 459 red + 509 green).
describe("charger-service — real data from plug-service sync", () => {

  // Pick a stable charger ID known to exist in the NTUA dataset
  const BLUE_ID  = 458729;
  const RED_ID   = 458664;
  const GREEN_ID = 458728;

  it("plug-service has populated charger-service with real charger data", async () => {
    const r = await req("GET", "/chargers/");
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    if (r.body.length < 100)
      throw new Error(`expected >100 chargers from plug-service sync, got ${r.body.length}`);
    log("total real charger count", { count: r.body.length });
  });

  it("chargers from all three providers are present", async () => {
    const r = await req("GET", "/chargers/");
    assertEqual(r.status, 200, "status");
    const providers = new Set(r.body.map(c => c.ProviderName));
    for (const expected of ["bluePlug", "redPlug", "greenPlug"]) {
      if (!providers.has(expected))
        throw new Error(`no chargers with ProviderName "${expected}" found`);
    }
    log("providers present", { providers: [...providers] });
  });

  it("fetches a real bluePlug charger by its provider-assigned id", async () => {
    const r = await req("GET", `/chargers/id/${BLUE_ID}`);
    log(`get bluePlug charger ${BLUE_ID}`, r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.id, BLUE_ID, "id");
    assertEqual(r.body.ProviderName, "bluePlug", "ProviderName");
  });

  it("fetches a real redPlug charger by its provider-assigned id", async () => {
    const r = await req("GET", `/chargers/id/${RED_ID}`);
    log(`get redPlug charger ${RED_ID}`, r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.id, RED_ID, "id");
    assertEqual(r.body.ProviderName, "redPlug", "ProviderName");
  });

  it("fetches a real greenPlug charger by its provider-assigned id", async () => {
    const r = await req("GET", `/chargers/id/${GREEN_ID}`);
    log(`get greenPlug charger ${GREEN_ID}`, r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.id, GREEN_ID, "id");
    assertEqual(r.body.ProviderName, "greenPlug", "ProviderName");
  });

  it("available chargers represent a meaningful portion of the dataset", async () => {
    const r = await req("GET", "/chargers/status/available");
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    if (r.body.length < 50)
      throw new Error(`expected ≥50 available chargers, got ${r.body.length}`);
    r.body.forEach(c => {
      if (c.status !== "available")
        throw new Error(`status filter leaked a "${c.status}" charger`);
    });
    log("available charger count", { count: r.body.length });
  });

  it("charger objects from real sync have required fields", async () => {
    const r = await req("GET", `/chargers/id/${BLUE_ID}`);
    assertEqual(r.status, 200, "status");
    const c = r.body;
    if (typeof c.id !== "number")      throw new Error(`id must be a number, got ${typeof c.id}`);
    if (typeof c.ProviderName !== "string") throw new Error("ProviderName must be a string");
    if (typeof c.status !== "string")  throw new Error("status must be a string");
    assertExists(c.address,       "address");
    assertExists(c.locationName,  "locationName");
    assertExists(c.connectionType,"connectionType");
    log("real charger fields", c);
  });
});
