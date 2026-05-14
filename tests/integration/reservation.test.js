import { describe, it, before } from "node:test";
import { req, assertEqual, assertExists, mintUserToken, log } from "./helpers.js";

const CHARGER_ID = 9001;
const USER_A_ID  = 101;

const tokenA = mintUserToken(USER_A_ID);

let reservationId;

describe("reservation-service — validation", () => {

  it("rejects request without JWT", async () => {
    const r = await req("POST", "/reservations/", { chargerId: CHARGER_ID, providerName: "x", duration: 30 });
    log("create — no token", r);
    assertEqual(r.status, 401, "status");
  });

  it("rejects reservation with missing chargerId", async () => {
    const r = await req("POST", "/reservations/", { providerName: "x", duration: 30 }, tokenA);
    log("create — missing chargerId", r);
    assertEqual(r.status, 400, "status");
  });

  it("rejects reservation with missing providerName", async () => {
    const r = await req("POST", "/reservations/", { chargerId: CHARGER_ID, duration: 30 }, tokenA);
    log("create — missing providerName", r);
    assertEqual(r.status, 400, "status");
  });
});

describe("reservation-service — lifecycle", () => {

  before(async () => {
    // ensure test charger exists and is available
    await req("POST", "/chargers/", { id: CHARGER_ID, ProviderName: "testProvider", status: "available" });
  });

  it("creates a reservation", async () => {
    const r = await req("POST", "/reservations/", {
      chargerId:    CHARGER_ID,
      providerName: "testProvider",
      duration:     45,
    }, tokenA);
    log("create — success", r);
    assertEqual(r.status, 201, "status");
    assertExists(r.body.reservationId, "reservationId");
    assertEqual(r.body.userId,       USER_A_ID,     "userId");
    assertEqual(r.body.chargerId,    CHARGER_ID,    "chargerId");
    assertEqual(r.body.duration,     45,            "duration");
    assertEqual(r.body.status,       "active",      "status");
    reservationId = r.body.reservationId;
  });

  it("charger status is reserved after reservation event", async () => {
    await new Promise(r => setTimeout(r, 1500)); // allow RabbitMQ event to propagate
    const r = await req("GET", `/chargers/id/${CHARGER_ID}`);
    log("charger status after reservation", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "reserved", "charger status");
  });

  it("gets reservation by id", async () => {
    const r = await req("GET", `/reservations/${reservationId}`, null, tokenA);
    log("get by id", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.reservationId, reservationId, "reservationId");
  });

  it("lists reservations for the user", async () => {
    const r = await req("GET", `/reservations/user/${USER_A_ID}`, null, tokenA);
    log("list by user", r);
    assertEqual(r.status, 200, "status");
    if (!Array.isArray(r.body)) throw new Error("expected array");
    const found = r.body.find(rv => rv.reservationId === reservationId);
    if (!found) throw new Error("reservation not in user list");
  });
});
