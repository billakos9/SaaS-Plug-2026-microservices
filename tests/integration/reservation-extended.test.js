import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, assert, log, mintUserToken } from "./helpers.js";

const RUN = Date.now();

// Unique user IDs per run to avoid collisions with the core reservation test
const USER_C = 301 + (RUN % 100);
const USER_D = 302 + (RUN % 100);

const tokenC = mintUserToken(USER_C);
const tokenD = mintUserToken(USER_D);

// Charger IDs unlikely to collide with real adapter IDs or the core test (9001)
const CHARGER_C = 80001;
const CHARGER_D = 80002;
const CHARGER_E = 80003;

// ── Input validation edge cases ────────────────────────────────────────────

describe("reservation-service — input validation edge cases", () => {

  before(async () => {
    await req("POST", "/chargers/", { id: CHARGER_C, ProviderName: "testProvider", status: "available" });
    await req("POST", "/chargers/", { id: CHARGER_D, ProviderName: "testProvider", status: "available" });
    await req("POST", "/chargers/", { id: CHARGER_E, ProviderName: "testProvider", status: "available" });
  });

  it("rejects duration = 0", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_C, providerName: "testProvider", duration: 0,
    }, tokenC);
    log("create — duration=0", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects negative duration", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_C, providerName: "testProvider", duration: -30,
    }, tokenC);
    log("create — negative duration", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects non-numeric chargerId string", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: "not-a-number", providerName: "testProvider", duration: 30,
    }, tokenC);
    log("create — non-numeric chargerId", r);
    assertEqual(r.status, 400, "status");
  });

  it("uses default duration of 60 when duration is omitted", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_C, providerName: "testProvider",
    }, tokenC);
    log("create — default duration", r);
    assertEqual(r.status, 201, "status");
    assertEqual(r.body.duration, 60, "default duration");
  });

  it("accepts large duration values", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_D, providerName: "testProvider", duration: 1440,
    }, tokenC);
    log("create — large duration", r);
    assertEqual(r.status, 201, "status");
    assertEqual(r.body.duration, 1440, "duration");
  });
});

// ── Response shape ─────────────────────────────────────────────────────────

describe("reservation-service — response shape", () => {

  let reservationId;

  before(async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_E, providerName: "testProvider", duration: 45,
    }, tokenC);
    reservationId = r.body.reservationId;
  });

  it("create response contains all expected fields", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_C, providerName: "testProvider", duration: 30,
    }, tokenD);
    log("create — shape", r);
    assertEqual(r.status, 201, "status");
    assertExists(r.body.reservationId, "reservationId");
    assertExists(r.body.userId,        "userId");
    assertExists(r.body.chargerId,     "chargerId");
    assertExists(r.body.providerName,  "providerName");
    assertExists(r.body.duration,      "duration");
    assertExists(r.body.status,        "status");
    assertExists(r.body.createdAt,     "createdAt");
    assertExists(r.body.updatedAt,     "updatedAt");
  });

  it("userId in response matches the JWT subject", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_D, providerName: "testProvider", duration: 30,
    }, tokenD);
    log("create — userId matches JWT", r);
    assertEqual(r.status, 201, "status");
    assertEqual(r.body.userId, USER_D, "userId matches JWT");
  });

  it("reservationId is a positive integer", async () => {
    const r = await req("GET", `/reservations/${reservationId}`, null, tokenC);
    assertEqual(r.status, 200, "status");
    if (!Number.isInteger(r.body.reservationId) || r.body.reservationId < 1)
      throw new Error(`reservationId must be positive integer, got ${r.body.reservationId}`);
  });

  it("createdAt and updatedAt are valid ISO dates", async () => {
    const r = await req("GET", `/reservations/${reservationId}`, null, tokenC);
    assertEqual(r.status, 200, "status");
    if (isNaN(Date.parse(r.body.createdAt)))
      throw new Error(`createdAt is not a valid date: ${r.body.createdAt}`);
    if (isNaN(Date.parse(r.body.updatedAt)))
      throw new Error(`updatedAt is not a valid date: ${r.body.updatedAt}`);
  });

  it("status is 'active' immediately after creation", async () => {
    const r = await req("GET", `/reservations/${reservationId}`, null, tokenC);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "active", "reservation status");
  });
});

// ── Auth enforcement on all routes ────────────────────────────────────────

describe("reservation-service — auth enforcement", () => {

  let reservationId;

  before(async () => {
    const r = await req("POST", "/reservations/", {
      chargerId: CHARGER_C, providerName: "testProvider", duration: 30,
    }, tokenC);
    reservationId = r.body.reservationId;
  });

  it("GET /reservations/:id without token returns 401", async () => {
    const r = await req("GET", `/reservations/${reservationId}`);
    log("get — no token", r);
    assertEqual(r.status, 401, "status");
  });

  it("GET /reservations/user/:userId without token returns 401", async () => {
    const r = await req("GET", `/reservations/user/${USER_C}`);
    log("list by user — no token", r);
    assertEqual(r.status, 401, "status");
  });
});

// ── Not-found behaviour ────────────────────────────────────────────────────

describe("reservation-service — not-found behaviour", () => {

  it("GET /reservations/:nonexistent returns 404", async () => {
    const r = await req("GET", "/reservations/999999999", null, tokenC);
    log("get — non-existent", r);
    assertEqual(r.status, 404, "status");
  });

  it("GET /reservations/user/:userId with no reservations returns empty array", async () => {
    const unusedUser = 99901;
    const r = await req("GET", `/reservations/user/${unusedUser}`, null, mintUserToken(unusedUser));
    log("list — user with no reservations", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    if (r.body.length !== 0) throw new Error(`expected empty array, got ${r.body.length} items`);
  });
});

// ── Concurrent reservations ────────────────────────────────────────────────

describe("reservation-service — concurrent reservations", () => {

  it("two different users can each hold an active reservation simultaneously", async () => {
    const [rC, rD] = await Promise.all([
      req("POST", "/reservations/", { chargerId: CHARGER_C, providerName: "testProvider", duration: 15 }, tokenC),
      req("POST", "/reservations/", { chargerId: CHARGER_D, providerName: "testProvider", duration: 20 }, tokenD),
    ]);
    log("concurrent reservations userC", rC);
    log("concurrent reservations userD", rD);
    assertEqual(rC.status, 201, "userC reservation status");
    assertEqual(rD.status, 201, "userD reservation status");
    assert(rC.body.reservationId !== rD.body.reservationId, "reservationIds must be unique");
  });

  it("reservation IDs are unique across sequential creates", async () => {
    const r1 = await req("POST", "/reservations/", { chargerId: CHARGER_C, providerName: "testProvider", duration: 10 }, tokenC);
    const r2 = await req("POST", "/reservations/", { chargerId: CHARGER_D, providerName: "testProvider", duration: 10 }, tokenD);
    assertEqual(r1.status, 201, "r1 status");
    assertEqual(r2.status, 201, "r2 status");
    assert(r2.body.reservationId > r1.body.reservationId, "IDs must be strictly increasing");
  });
});
