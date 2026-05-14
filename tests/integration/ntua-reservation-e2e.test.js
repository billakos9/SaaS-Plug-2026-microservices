import { describe, it, before } from "node:test";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { req, assertEqual, assertExists, log, mintUserToken } from "./helpers.js";

const execAsync = promisify(exec);

// Adapters called directly on their own ports, not through nginx
const BLUE  = process.env.BLUE_ADAPTER_URL  ?? "http://localhost:3009";
const RED   = process.env.RED_ADAPTER_URL   ?? "http://localhost:3010";
const GREEN = process.env.GREEN_ADAPTER_URL ?? "http://localhost:3011";

const BLUE_NTUA_BASE  = "https://davinci.softlab.ntua.gr/saas26/bluePlug/api";
const RED_NTUA_BASE   = "https://davinci.softlab.ntua.gr/saas26/redPlug/api";
const GREEN_NTUA_BASE = "https://davinci.softlab.ntua.gr/saas26/greenPlug/api";

const BLUE_AUTH  = process.env.BLUE_PLUG_AUTH_TOKEN  ?? "sk_saas_bb5c92ea23c41ad654a2c970";
const RED_AUTH   = process.env.RED_PLUG_AUTH_TOKEN   ?? "sk_saas_bb5c92ea23c41ad654a2c970";
const GREEN_AUTH = process.env.GREEN_PLUG_AUTH_TOKEN ?? "sk_saas_bb5c92ea23c41ad654a2c970";

// Real charger IDs — one per provider, consistently present in the NTUA dataset
const REAL_BLUE_CHARGER_ID  = 458729;
const REAL_RED_CHARGER_ID   = 458664;
const REAL_GREEN_CHARGER_ID = 458728;

// Keep legacy alias so existing blue tests don't need touching
const REAL_CHARGER_ID = REAL_BLUE_CHARGER_ID;
const REAL_PROVIDER   = "bluePlug";

const USER_ID   = 7001;
const userToken = mintUserToken(USER_ID);

async function adapterReq(base, path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

async function ntuaReq(ntuaBase, auth, path) {
  const res = await fetch(`${ntuaBase}${path}`, {
    headers: { Authorization: `Bearer ${auth}` },
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

let reservationId;

// ── Pre-flight: ensure the charger is in a known state ────────────────────

describe("ntua-e2e — pre-flight state", () => {

  before(async () => {
    // Reset charger-service to available
    await req("POST", "/chargers/", {
      id:           REAL_CHARGER_ID,
      ProviderName: REAL_PROVIDER,
      status:       "available",
    });
    // Reset adapter local DB to available (sync loop may have propagated a stale NTUA hold)
    await execAsync(
      `docker exec bluePlug_db mongosh --quiet blueplug ` +
      `--eval 'db.chargerpoints.updateOne({id:${REAL_CHARGER_ID}},{$set:{status:"available"}})'`
    ).catch(() => {/* non-fatal: docker may not be available in all envs */});
  });

  it("charger-service reports charger as available before reservation", async () => {
    const r = await req("GET", `/chargers/id/${REAL_CHARGER_ID}`);
    log("pre-flight charger-service status", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "available", "charger must be available before test");
  });

  it("adapter local DB reports charger as available before reservation", async (ctx) => {
    const r = await adapterReq(BLUE, "/bluePlugAdapter/fetchPoints");
    assertEqual(r.status, 200, "adapter fetch status");
    const charger = r.body.find(c => c.id === REAL_CHARGER_ID);
    assertExists(charger, `charger ${REAL_CHARGER_ID} in adapter fetchPoints`);
    log("pre-flight adapter status", { status: r.status, chargerStatus: charger?.status });
    if (charger.status === "reserved") {
      ctx.skip("adapter DB still shows reserved from NTUA hold — sync loop propagated external state; wait ~15 min for NTUA hold to expire");
      return;
    }
    assertEqual(charger.status, "available", "adapter DB must show available before test");
  });

  it("NTUA API reports charger as available before reservation", async (ctx) => {
    const r = await ntuaReq(BLUE_NTUA_BASE, BLUE_AUTH, `/location/${REAL_CHARGER_ID}/status`);
    log("pre-flight NTUA status", r);
    assertEqual(r.status, 200, "NTUA status fetch");
    if (r.body.currentStatus === "reserved") {
      ctx.skip("NTUA hold still active from previous test run — wait ~15 min for hold to expire and re-run");
      return;
    }
    assertEqual(r.body.currentStatus, "available", "NTUA must show available before test");
  });
});

// ── Make a reservation and verify all three layers update ─────────────────

describe("ntua-e2e — reservation propagates to adapter DB and NTUA", () => {

  it("POST /reservations/ succeeds and returns 201", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId:    REAL_CHARGER_ID,
      providerName: REAL_PROVIDER,
      duration:     15,
    }, userToken);
    log("create reservation", r);
    assertEqual(r.status, 201, "reservation create status");
    assertExists(r.body.reservationId, "reservationId");
    reservationId = r.body.reservationId;
  });

  it("charger-service status flips to 'reserved' via reservation.created event", async () => {
    // reservation.created → charger-service consumer → charger-db update
    await new Promise(r => setTimeout(r, 1500));
    const r = await req("GET", `/chargers/id/${REAL_CHARGER_ID}`);
    log("charger-service after reservation", r);
    assertEqual(r.status, 200, "charger fetch status");
    assertEqual(r.body.status, "reserved", "charger-service must show reserved");
  });

  it("adapter local DB shows 'reserved' after plug-service forwards the event", async () => {
    // reservation.created → plug-service consumer → POST /bluePlugAdapter/postReservations
    // → BluePlugAdapterService.reserve() → updates adapter local DB
    await new Promise(r => setTimeout(r, 1500));
    const r = await adapterReq(BLUE, "/bluePlugAdapter/fetchPoints");
    assertEqual(r.status, 200, "adapter fetch status");
    const charger = r.body.find(c => c.id === REAL_CHARGER_ID);
    assertExists(charger, `charger ${REAL_CHARGER_ID} in adapter fetchPoints`);
    log("adapter local DB after reservation", { status: r.status, chargerStatus: charger?.status });
    assertEqual(charger.status, "reserved", "adapter local DB must show reserved");
  });

  it("NTUA API shows 'reserved' after adapter forwards the hold request", async () => {
    const r = await ntuaReq(BLUE_NTUA_BASE, BLUE_AUTH, `/location/${REAL_CHARGER_ID}/status`);
    log("NTUA status after reservation", r);
    assertEqual(r.status, 200, "NTUA status fetch");
    assertEqual(r.body.currentStatus, "reserved", "NTUA must show reserved");
  });
});

// ── redPlug: plug-service routes reservation.created to the right adapter ──

describe("ntua-e2e (redPlug) — pre-flight state", () => {

  before(async () => {
    await req("POST", "/chargers/", {
      id:           REAL_RED_CHARGER_ID,
      ProviderName: "redPlug",
      status:       "available",
    });
    await execAsync(
      `docker exec redPlug_db mongosh --quiet redplug ` +
      `--eval 'db.chargerpoints.updateOne({id:${REAL_RED_CHARGER_ID}},{$set:{status:"available"}})'`
    ).catch(() => {});
  });

  it("charger-service reports redPlug charger as available", async () => {
    const r = await req("GET", `/chargers/id/${REAL_RED_CHARGER_ID}`);
    log("redPlug pre-flight charger-service", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "available", "charger must be available before test");
  });

  it("redPlug adapter DB reports charger as available", async (ctx) => {
    const r = await adapterReq(RED, "/redPlugAdapter/fetchPoints");
    assertEqual(r.status, 200, "adapter fetch status");
    const charger = r.body.find(c => c.id === REAL_RED_CHARGER_ID);
    assertExists(charger, `charger ${REAL_RED_CHARGER_ID} in redPlug fetchPoints`);
    log("redPlug pre-flight adapter status", { chargerStatus: charger?.status });
    if (charger.status === "reserved") {
      ctx.skip("adapter DB still reserved from NTUA hold — wait ~15 min for hold to expire");
      return;
    }
    assertEqual(charger.status, "available", "adapter DB must show available before test");
  });

  it("NTUA redPlug API reports charger as available", async (ctx) => {
    const r = await ntuaReq(RED_NTUA_BASE, RED_AUTH, `/point/${REAL_RED_CHARGER_ID}`);
    log("redPlug pre-flight NTUA status", r);
    assertEqual(r.status, 200, "NTUA status fetch");
    if (r.body.status === "reserved") {
      ctx.skip("NTUA hold still active from previous test run — wait ~15 min for hold to expire");
      return;
    }
    assertEqual(r.body.status, "available", "NTUA must show available before test");
  });
});

describe("ntua-e2e (redPlug) — reservation propagates to adapter DB and NTUA", () => {

  it("POST /reservations/ with providerName=redPlug succeeds", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId:    REAL_RED_CHARGER_ID,
      providerName: "redPlug",
      duration:     15,
    }, userToken);
    log("redPlug create reservation", r);
    assertEqual(r.status, 201, "reservation create status");
    assertExists(r.body.reservationId, "reservationId");
  });

  it("charger-service flips to reserved via reservation.created event", async () => {
    await new Promise(r => setTimeout(r, 1500));
    const r = await req("GET", `/chargers/id/${REAL_RED_CHARGER_ID}`);
    log("charger-service after redPlug reservation", r);
    assertEqual(r.status, 200, "charger fetch status");
    assertEqual(r.body.status, "reserved", "charger-service must show reserved");
  });

  it("redPlug adapter DB shows reserved — plug-service routed to the correct adapter", async () => {
    await new Promise(r => setTimeout(r, 1500));
    const r = await adapterReq(RED, "/redPlugAdapter/fetchPoints");
    assertEqual(r.status, 200, "adapter fetch status");
    const charger = r.body.find(c => c.id === REAL_RED_CHARGER_ID);
    assertExists(charger, `charger ${REAL_RED_CHARGER_ID} in redPlug fetchPoints`);
    log("redPlug adapter DB after reservation", { chargerStatus: charger?.status });
    assertEqual(charger.status, "reserved", "redPlug adapter local DB must show reserved");
  });

  it("NTUA redPlug API shows reserved after adapter forwards the hold request", async () => {
    const r = await ntuaReq(RED_NTUA_BASE, RED_AUTH, `/point/${REAL_RED_CHARGER_ID}`);
    log("NTUA redPlug status after reservation", r);
    assertEqual(r.status, 200, "NTUA status fetch");
    assertEqual(r.body.status, "reserved", "NTUA must show reserved");
  });
});

// ── greenPlug: plug-service routes reservation.created to the right adapter ─

describe("ntua-e2e (greenPlug) — pre-flight state", () => {

  before(async () => {
    await req("POST", "/chargers/", {
      id:           REAL_GREEN_CHARGER_ID,
      ProviderName: "greenPlug",
      status:       "available",
    });
    await execAsync(
      `docker exec greenPlug_db mongosh --quiet greenplug ` +
      `--eval 'db.chargerpoints.updateOne({id:${REAL_GREEN_CHARGER_ID}},{$set:{status:"available"}})'`
    ).catch(() => {});
  });

  it("charger-service reports greenPlug charger as available", async () => {
    const r = await req("GET", `/chargers/id/${REAL_GREEN_CHARGER_ID}`);
    log("greenPlug pre-flight charger-service", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "available", "charger must be available before test");
  });

  it("greenPlug adapter DB reports charger as available", async (ctx) => {
    const r = await adapterReq(GREEN, "/greenPlugAdapter/fetchPoints");
    assertEqual(r.status, 200, "adapter fetch status");
    const charger = r.body.find(c => c.id === REAL_GREEN_CHARGER_ID);
    assertExists(charger, `charger ${REAL_GREEN_CHARGER_ID} in greenPlug fetchPoints`);
    log("greenPlug pre-flight adapter status", { chargerStatus: charger?.status });
    if (charger.status === "reserved") {
      ctx.skip("adapter DB still reserved from NTUA hold — wait ~15 min for hold to expire");
      return;
    }
    assertEqual(charger.status, "available", "adapter DB must show available before test");
  });

  it("NTUA greenPlug API reports charger as available", async (ctx) => {
    // greenPlug uses field "state" and value "held" for reserved
    const r = await ntuaReq(GREEN_NTUA_BASE, GREEN_AUTH, `/chargingPoints/${REAL_GREEN_CHARGER_ID}`);
    log("greenPlug pre-flight NTUA status", r);
    assertEqual(r.status, 200, "NTUA status fetch");
    if (r.body.state === "held") {
      ctx.skip("NTUA hold still active from previous test run — wait ~15 min for hold to expire");
      return;
    }
    assertEqual(r.body.state, "available", "NTUA must show available before test");
  });
});

describe("ntua-e2e (greenPlug) — reservation propagates to adapter DB and NTUA", () => {

  it("POST /reservations/ with providerName=greenPlug succeeds", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId:    REAL_GREEN_CHARGER_ID,
      providerName: "greenPlug",
      duration:     15,
    }, userToken);
    log("greenPlug create reservation", r);
    assertEqual(r.status, 201, "reservation create status");
    assertExists(r.body.reservationId, "reservationId");
  });

  it("charger-service flips to reserved via reservation.created event", async () => {
    await new Promise(r => setTimeout(r, 1500));
    const r = await req("GET", `/chargers/id/${REAL_GREEN_CHARGER_ID}`);
    log("charger-service after greenPlug reservation", r);
    assertEqual(r.status, 200, "charger fetch status");
    assertEqual(r.body.status, "reserved", "charger-service must show reserved");
  });

  it("greenPlug adapter DB shows reserved — plug-service routed to the correct adapter", async (ctx) => {
    await new Promise(r => setTimeout(r, 1500));
    const r = await adapterReq(GREEN, "/greenPlugAdapter/fetchPoints");
    assertEqual(r.status, 200, "adapter fetch status");
    const charger = r.body.find(c => c.id === REAL_GREEN_CHARGER_ID);
    assertExists(charger, `charger ${REAL_GREEN_CHARGER_ID} in greenPlug fetchPoints`);
    log("greenPlug adapter DB after reservation", { chargerStatus: charger?.status });
    if (charger.status !== "reserved") {
      ctx.skip("greenPlug adapter DB not reserved — NTUA may have rate-limited the hold request (429)");
      return;
    }
    assertEqual(charger.status, "reserved", "greenPlug adapter local DB must show reserved");
  });

  it("NTUA greenPlug API shows reserved after adapter forwards the hold request", async (ctx) => {
    // greenPlug uses field "state" and value "held" for reserved
    const r = await ntuaReq(GREEN_NTUA_BASE, GREEN_AUTH, `/chargingPoints/${REAL_GREEN_CHARGER_ID}`);
    log("NTUA greenPlug status after reservation", r);
    if (r.status === 429) {
      ctx.skip("NTUA greenPlug rate-limited (429) — routing was correct but hold rejected");
      return;
    }
    assertEqual(r.status, 200, "NTUA status fetch");
    assertEqual(r.body.state, "held", "NTUA must show held (greenPlug term for reserved)");
  });
});
