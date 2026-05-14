import { describe, it, before, after } from "node:test";
import { req, assertEqual, assertExists, assert, log, mintUserToken } from "./helpers.js";

const RUN = Date.now();

const CROSS_ADMIN = {
  firstName:       "Cross",
  lastName:        "ServiceTest",
  email:           `cross_${RUN}@saas.com`,
  password:        "crosspass789",
  registrationKey: "super_secret_admin_key",
};

let adminToken;

// Real bluePlug charger that always comes from the external NTUA API
const REAL_CHARGER_ID   = 458729;
const REAL_PROVIDER     = "bluePlug";
const CROSS_USER_ID     = 5001 + (RUN % 100);
const crossUserToken    = mintUserToken(CROSS_USER_ID);

// ── Admin analytics vs. direct service counts ─────────────────────────────

describe("cross-service — analytics vs. direct service counts", () => {

  before(async () => {
    const reg = await req("POST", "/admin/register", CROSS_ADMIN);
    assertExists(reg.body.adminId, "adminId from registration");
    const login = await req("POST", "/admin/login", {
      email:    CROSS_ADMIN.email,
      password: CROSS_ADMIN.password,
    });
    adminToken = login.body.token;
  });

  it("analytics charger total matches GET /chargers/ count", async () => {
    const [analytics, chargers] = await Promise.all([
      req("GET", "/admin/analytics", null, adminToken),
      req("GET", "/chargers/"),
    ]);
    assertEqual(analytics.status, 200, "analytics status");
    assertEqual(chargers.status,  200, "chargers status");
    assertEqual(
      analytics.body.chargers.total,
      chargers.body.length,
      "analytics charger total matches direct count",
    );
    log("charger total cross-check", {
      status: 200,
      analytics: analytics.body.chargers.total,
      direct: chargers.body.length,
    });
  });

  it("analytics provider total matches GET /providers/ count", async () => {
    const [analytics, providers] = await Promise.all([
      req("GET", "/admin/analytics", null, adminToken),
      req("GET", "/providers/"),
    ]);
    assertEqual(analytics.status, 200, "analytics status");
    assertEqual(providers.status, 200, "providers status");
    if (typeof analytics.body.providers?.total !== "number")
      throw new Error(`analytics.providers.total missing or not a number`);
    assertEqual(
      analytics.body.providers.total,
      providers.body.length,
      "analytics provider total matches direct count",
    );
    log("provider total cross-check", {
      status: 200,
      analytics: analytics.body.providers.total,
      direct: providers.body.length,
    });
  });

  it("analytics byStatus values sum to chargers.total", async () => {
    const r = await req("GET", "/admin/analytics", null, adminToken);
    assertEqual(r.status, 200, "status");
    const byStatus = r.body.chargers.byStatus;
    const sum = Object.values(byStatus).reduce((a, b) => a + b, 0);
    assertEqual(sum, r.body.chargers.total, "sum of byStatus equals total");
    log("byStatus sum", { status: 200, sum, total: r.body.chargers.total });
  });
});

// ── Admin proxy vs. direct charger-service ───────────────────────────────

describe("cross-service — admin proxy vs. charger-service", () => {

  it("GET /admin/chargers count matches GET /chargers/ count", async () => {
    const [proxy, direct] = await Promise.all([
      req("GET", "/admin/chargers", null, adminToken),
      req("GET", "/chargers/"),
    ]);
    assertEqual(proxy.status,  200, "proxy status");
    assertEqual(direct.status, 200, "direct status");
    assertEqual(proxy.body.length, direct.body.length, "proxy and direct charger counts match");
    log("proxy vs direct charger count", { status: 200, proxy: proxy.body.length, direct: direct.body.length });
  });

  it("admin charger id=REAL_CHARGER_ID matches direct charger record", async () => {
    const [proxy, direct] = await Promise.all([
      req("GET", `/admin/chargers/${REAL_CHARGER_ID}`, null, adminToken),
      req("GET", `/chargers/id/${REAL_CHARGER_ID}`),
    ]);
    assertEqual(proxy.status,  200, "proxy status");
    assertEqual(direct.status, 200, "direct status");
    assertEqual(proxy.body.id,           direct.body.id,           "id matches");
    assertEqual(proxy.body.ProviderName, direct.body.ProviderName, "ProviderName matches");
    assertEqual(proxy.body.status,       direct.body.status,       "status matches");
    log("proxy vs direct single charger", { status: 200, id: proxy.body.id });
  });

  it("GET /admin/providers count matches GET /providers/ count", async () => {
    const [proxy, direct] = await Promise.all([
      req("GET", "/admin/providers", null, adminToken),
      req("GET", "/providers/"),
    ]);
    assertEqual(proxy.status,  200, "proxy status");
    assertEqual(direct.status, 200, "direct status");
    assertEqual(proxy.body.length, direct.body.length, "proxy and direct provider counts match");
    log("proxy vs direct provider count", { status: 200, proxy: proxy.body.length, direct: direct.body.length });
  });
});

// ── Admin proxy creates provider → visible in provider-service ────────────

describe("cross-service — provider creation via admin proxy", () => {

  let createdProviderId;

  it("POST /admin/providers creates a provider visible in GET /providers/", async () => {
    const newProvider = {
      providerName: `crossProv_${RUN}`,
      email:        `cross_${RUN}@provider.com`,
      password:     "crosspw123",
      apiBaseUrl:   `http://cross-${RUN}:3000`,
      apiKey:       `cross-key-${RUN}`,
    };

    const create = await req("POST", "/admin/providers", newProvider, adminToken);
    log("proxy create provider", create);
    assertEqual(create.status, 201, "create status");
    assertExists(create.body.providerId, "providerId");
    createdProviderId = create.body.providerId;

    const direct = await req("GET", "/providers/");
    const found = direct.body.find(p => p.providerId === createdProviderId);
    if (!found) throw new Error(`created provider (id=${createdProviderId}) not found via direct provider-service`);
    log("provider visible in direct list", { status: 200, providerId: createdProviderId });
  });

  it("cleanup: DELETE proxy-created provider", async () => {
    if (!createdProviderId) return;
    const r = await req("DELETE", `/providers/delete/${createdProviderId}`);
    if (r.status !== 200 && r.status !== 204)
      throw new Error(`cleanup failed: status ${r.status}`);
    log("cleanup provider", r);

    const direct = await req("GET", "/providers/");
    const stillThere = direct.body.find(p => p.providerId === createdProviderId);
    if (stillThere) throw new Error("provider still present after delete");
  });
});

// ── Reservation → charger status RabbitMQ round-trip ─────────────────────

describe("cross-service — reservation event propagates to charger-service", () => {

  let reservationId;

  before(async () => {
    // Ensure the real charger is in the DB as available before testing
    await req("POST", "/chargers/", {
      id:           REAL_CHARGER_ID,
      ProviderName: REAL_PROVIDER,
      status:       "available",
    });
  });

  it("charger is initially available", async () => {
    const r = await req("GET", `/chargers/id/${REAL_CHARGER_ID}`);
    log("initial charger status", r);
    assertEqual(r.status, 200, "status");
    assertEqual(r.body.status, "available", "initial status must be available");
  });

  it("POST /reservations/ → reservation.created event → charger flips to 'reserved'", async () => {
    const create = await req("POST", "/reservations/", {
      chargerId:    REAL_CHARGER_ID,
      providerName: REAL_PROVIDER,
      duration:     30,
    }, crossUserToken);
    log("create reservation", create);
    assertEqual(create.status, 201, "reservation created");
    reservationId = create.body.reservationId;

    // Wait for RabbitMQ event to propagate
    await new Promise(r => setTimeout(r, 1500));

    const charger = await req("GET", `/chargers/id/${REAL_CHARGER_ID}`);
    log("charger after reservation", charger);
    assertEqual(charger.status, 200, "charger fetch status");
    assertEqual(charger.body.status, "reserved", "charger status after reservation");
  });

  after(async () => {
    // Reset charger to available so subsequent test suites see a clean slate
    await req("POST", "/chargers/", {
      id:           REAL_CHARGER_ID,
      ProviderName: REAL_PROVIDER,
      status:       "available",
    });
  });
});

// ── byStatus analytics updated after reservation event ───────────────────

describe("cross-service — analytics reflects live charger state", () => {

  let reservationId2;

  before(async () => {
    // Reset the real charger to available
    await req("POST", "/chargers/", {
      id:           REAL_CHARGER_ID,
      ProviderName: REAL_PROVIDER,
      status:       "available",
    });
    await new Promise(r => setTimeout(r, 300));
  });

  it("reserving charger increments analytics 'reserved' count and decrements 'available'", async () => {
    const before = await req("GET", "/admin/analytics", null, adminToken);
    assertEqual(before.status, 200, "analytics before status");
    const availBefore    = before.body.chargers.byStatus.available    ?? 0;
    const reservedBefore = before.body.chargers.byStatus.reserved ?? 0;

    const create = await req("POST", "/reservations/", {
      chargerId:    REAL_CHARGER_ID,
      providerName: REAL_PROVIDER,
      duration:     15,
    }, crossUserToken);
    assertEqual(create.status, 201, "reservation created");
    reservationId2 = create.body.reservationId;

    await new Promise(r => setTimeout(r, 1500));

    const after = await req("GET", "/admin/analytics", null, adminToken);
    assertEqual(after.status, 200, "analytics after status");
    const availAfter    = after.body.chargers.byStatus.available    ?? 0;
    const reservedAfter = after.body.chargers.byStatus.reserved ?? 0;

    log("analytics delta", {
      status: 200,
      availBefore, availAfter,
      reservedBefore, reservedAfter,
    });

    if (reservedAfter !== reservedBefore + 1)
      throw new Error(`reserved count should increase by 1: was ${reservedBefore}, now ${reservedAfter}`);
    if (availAfter !== availBefore - 1)
      throw new Error(`available count should decrease by 1: was ${availBefore}, now ${availAfter}`);
  });

  after(async () => {
    // Reset charger to available so analytics stay consistent for subsequent tests
    await req("POST", "/chargers/", {
      id:           REAL_CHARGER_ID,
      ProviderName: REAL_PROVIDER,
      status:       "available",
    });
  });
});
