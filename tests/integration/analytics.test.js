import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, assert, mintUserToken, mintProviderToken, log } from "./helpers.js";

// Charger dedicated to analytics tests — must not overlap with ntua-e2e chargers
const ANALYTICS_CHARGER_ID = 9999;
const ANALYTICS_PROVIDER   = "testProvider";
const KWH_PRICE            = 0.30;
const DURATION             = 30; // minutes

const USER_ID   = 8001;
const userToken = mintUserToken(USER_ID);

const bluePlugToken       = mintProviderToken("bluePlug");
const analyticsProvToken  = mintProviderToken(ANALYTICS_PROVIDER);
const unknownProvToken    = mintProviderToken("nonExistentProvider");

const currentPeriod = new Date().toISOString().slice(0, 7); // "YYYY-MM"
const pastPeriod    = "2000-01"; // guaranteed to have no data

// ── Health and routing ────────────────────────────────────────────────────────

describe("analytics-service — health and routing", () => {

  it("GET /analytics/providers returns 200", async () => {
    const r = await req("GET", `/analytics/providers?period=${currentPeriod}`, null, bluePlugToken);
    log("GET /analytics/providers", r);
    assertEqual(r.status, 200, "status");
  });

  it("GET /analytics/provider/bluePlug returns 200", async () => {
    const r = await req("GET", `/analytics/provider/bluePlug?period=${currentPeriod}`, null, bluePlugToken);
    log("GET /analytics/provider/bluePlug", r);
    assertEqual(r.status, 200, "status");
  });

  it("unmatched route returns 404", async () => {
    const r = await req("GET", "/analytics/nonexistent");
    log("unmatched route", r);
    assertEqual(r.status, 404, "status");
  });

  it("missing token returns 401", async () => {
    const r = await req("GET", `/analytics/provider/bluePlug?period=${currentPeriod}`);
    log("no token", r);
    assertEqual(r.status, 401, "status");
  });

  it("wrong provider token returns 403", async () => {
    const r = await req("GET", `/analytics/provider/bluePlug?period=${currentPeriod}`, null, analyticsProvToken);
    log("wrong provider token", r);
    assertEqual(r.status, 403, "status");
  });
});

// ── Report field structure ────────────────────────────────────────────────────

describe("analytics-service — report field structure", () => {

  let report;

  before(async () => {
    const r = await req("GET", `/analytics/provider/bluePlug?period=${currentPeriod}`, null, bluePlugToken);
    report = r.body;
  });

  it("provider report contains all required fields", async () => {
    assertExists(report,                         "report body");
    assertExists(report.providerName,            "providerName");
    assertExists(report.period,                  "period");
    if (report.totalChargers === undefined || report.totalChargers === null)
      throw new Error("totalChargers missing");
    assertExists(report.chargersByStatus,        "chargersByStatus");
    if (report.utilizationRate === undefined || report.utilizationRate === null)
      throw new Error("utilizationRate missing");
    if (report.averageKwhPrice === undefined || report.averageKwhPrice === null)
      throw new Error("averageKwhPrice missing");
    if (report.totalReservations === undefined || report.totalReservations === null)
      throw new Error("totalReservations missing");
    if (report.averageDurationMinutes === undefined || report.averageDurationMinutes === null)
      throw new Error("averageDurationMinutes missing");
    if (report.totalRevenue === undefined || report.totalRevenue === null)
      throw new Error("totalRevenue missing");
  });

  it("providerName and period echo the request params", async () => {
    assertEqual(report.providerName, "bluePlug",     "providerName");
    assertEqual(report.period,       currentPeriod,  "period");
  });

  it("chargersByStatus counts sum to totalChargers", async () => {
    const statusSum = Object.values(report.chargersByStatus ?? {}).reduce((a, b) => a + b, 0);
    assertEqual(statusSum, report.totalChargers, "chargersByStatus sum vs totalChargers");
  });

  it("utilizationRate is a number in [0, 1]", async () => {
    assert(typeof report.utilizationRate === "number", "utilizationRate is a number");
    assert(report.utilizationRate >= 0 && report.utilizationRate <= 1,
      `utilizationRate out of range: ${report.utilizationRate}`);
  });

  it("averageKwhPrice is a non-negative number", async () => {
    assert(typeof report.averageKwhPrice === "number", "averageKwhPrice is a number");
    assert(report.averageKwhPrice >= 0, `averageKwhPrice negative: ${report.averageKwhPrice}`);
  });

  it("reservation stats are non-negative numbers", async () => {
    assert(typeof report.totalReservations    === "number" && report.totalReservations    >= 0, "totalReservations");
    assert(typeof report.averageDurationMinutes === "number" && report.averageDurationMinutes >= 0, "averageDurationMinutes");
    assert(typeof report.totalRevenue         === "number" && report.totalRevenue         >= 0, "totalRevenue");
  });

  it("unknown provider returns zero reservation stats (not 404)", async () => {
    const r = await req("GET", `/analytics/provider/nonExistentProvider?period=${currentPeriod}`, null, unknownProvToken);
    log("unknown provider", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.totalReservations,    0, "totalReservations");
    assertEqual(r.body.totalRevenue,         0, "totalRevenue");
    assertEqual(r.body.averageDurationMinutes, 0, "averageDurationMinutes");
  });

  it("querying a past period with no data returns zeros for reservation stats", async () => {
    const r = await req("GET", `/analytics/provider/bluePlug?period=${pastPeriod}`, null, bluePlugToken);
    log("past period report", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.totalReservations,    0, "totalReservations for past period");
    assertEqual(r.body.totalRevenue,         0, "totalRevenue for past period");
  });
});

// ── All-providers endpoint ────────────────────────────────────────────────────

describe("analytics-service — all-providers endpoint", () => {

  let result;

  before(async () => {
    const r = await req("GET", `/analytics/providers?period=${currentPeriod}`, null, bluePlugToken);
    result = r.body;
  });

  it("returns period and providers array", async () => {
    assertExists(result,          "body");
    assertEqual(result.period, currentPeriod, "period");
    if (!Array.isArray(result.providers))
      throw new Error(`expected providers array, got ${typeof result.providers}`);
    log("providers count", { status: 200, providers: result.providers.length });
  });

  it("each provider entry has the standard report fields", async () => {
    for (const p of result.providers.slice(0, 5)) {
      assertExists(p.providerName,    `providerName in ${JSON.stringify(p)}`);
      assertExists(p.period,          "period");
      if (p.totalChargers === undefined) throw new Error(`totalChargers missing for ${p.providerName}`);
      assertExists(p.chargersByStatus, "chargersByStatus");
      if (p.utilizationRate    === undefined) throw new Error(`utilizationRate missing for ${p.providerName}`);
      if (p.totalReservations  === undefined) throw new Error(`totalReservations missing for ${p.providerName}`);
      if (p.totalRevenue       === undefined) throw new Error(`totalRevenue missing for ${p.providerName}`);
    }
  });

  it("generatedAt timestamp is present", async () => {
    assertExists(result.generatedAt, "generatedAt");
    assert(!isNaN(Date.parse(result.generatedAt)), "generatedAt is a valid ISO date");
  });
});

// ── Event-driven accumulation ─────────────────────────────────────────────────
//
// Creates a reservation for a charger with known kwhPrice, waits for the
// reservation.created event to reach analytics-service, then verifies that
// totalReservations, totalRevenue, and averageDurationMinutes are updated.

describe("analytics-service — event-driven stat accumulation", () => {

  let statBefore;

  before(async () => {
    // Register test charger with a known kwhPrice
    await req("POST", "/chargers/", {
      id:           ANALYTICS_CHARGER_ID,
      ProviderName: ANALYTICS_PROVIDER,
      status:       "available",
      kwhPrice:     KWH_PRICE,
    });

    // Capture baseline stats before the reservation
    const r = await req("GET", `/analytics/provider/${ANALYTICS_PROVIDER}?period=${currentPeriod}`, null, analyticsProvToken);
    statBefore = r.body;
    log("baseline stats", r);
  });

  it("POST /reservations/ succeeds and returns 201", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId:    ANALYTICS_CHARGER_ID,
      providerName: ANALYTICS_PROVIDER,
      duration:     DURATION,
    }, userToken);
    log("create reservation", r);
    assertEqual(r.status, 201, "reservation create status");
    assertExists(r.body.reservationId, "reservationId");
    // kwhPrice should be recorded on the reservation from charger-service lookup
    assertEqual(r.body.kwhPrice, KWH_PRICE, "kwhPrice stored on reservation");
  });

  it("totalReservations increments by 1 after event propagates", async () => {
    await new Promise(r => setTimeout(r, 1500)); // wait for RabbitMQ event
    const r = await req("GET", `/analytics/provider/${ANALYTICS_PROVIDER}?period=${currentPeriod}`, null, analyticsProvToken);
    log("stats after reservation", r);
    assertEqual(r.status, 200, "status");
    const delta = r.body.totalReservations - (statBefore?.totalReservations ?? 0);
    assertEqual(delta, 1, "totalReservations delta");
  });

  it("totalRevenue increases by duration/60 × kwhPrice (rounded to 2dp)", async () => {
    const r = await req("GET", `/analytics/provider/${ANALYTICS_PROVIDER}?period=${currentPeriod}`, null, analyticsProvToken);
    const expectedRevenue  = Math.round(DURATION / 60 * KWH_PRICE * 100) / 100; // 0.15
    const revenueBefore    = statBefore?.totalRevenue ?? 0;
    const delta = Math.round((r.body.totalRevenue - revenueBefore) * 100) / 100;
    log("revenue delta", { status: r.status, delta, expectedRevenue });
    assertEqual(delta, expectedRevenue, "totalRevenue delta");
  });

  it("averageDurationMinutes reflects the reservation duration", async () => {
    const r = await req("GET", `/analytics/provider/${ANALYTICS_PROVIDER}?period=${currentPeriod}`, null, analyticsProvToken);
    log("averageDurationMinutes", r);
    const avg = r.body.averageDurationMinutes;
    // Average must be a positive number; if this is the only reservation for the
    // provider in this period it equals DURATION, otherwise it changes — just verify > 0.
    assert(typeof avg === "number" && avg > 0, `averageDurationMinutes should be positive, got ${avg}`);
  });
});
