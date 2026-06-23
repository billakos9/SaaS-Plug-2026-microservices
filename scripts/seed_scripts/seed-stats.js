/**
 * seed-stats.js
 * Run inside reservation_service container:
 *   docker exec reservation_service node /tmp/seed-stats.js
 *
 * Deterministically generates ~2 years of completed reservations (2024-06-15 →
 * 2026-05-31) spread across all 3 providers, then writes:
 *   - reservation-db  : reservations collection + counter
 *   - analytics-db    : analyticstats collection (per-provider per-month)
 *   - billing-db      : billedreservations collection (for invoice generation)
 */

'use strict';

const mongoose = require('/saas26-09/node_modules/mongoose');

// ── Seeded PRNG (mulberry32, seed = 42) ─────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand    = mulberry32(42);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pickItem = (arr) => arr[randInt(0, arr.length - 1)];

// ── Charger pools (10 per provider) ─────────────────────────────────────────
const CHARGERS = {
  bluePlug: [
    { id: 1285757, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Syntagma Sq.'    },
    { id: 2130785, cap: 50,  kwhPrice: 0.59, locationName: 'bluePlug · Kifisias Ave.'   },
    { id: 1515488, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Glyfada'         },
    { id: 1285758, cap: 100, kwhPrice: 0.59, locationName: 'bluePlug · Airport Fast'    },
    { id: 2130786, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Piraeus'         },
    { id: 1515490, cap: 50,  kwhPrice: 0.59, locationName: 'bluePlug · Kolonaki'        },
    { id: 1285760, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Patisia'         },
    { id: 2130790, cap: 150, kwhPrice: 0.65, locationName: 'bluePlug · Chalandri DC'    },
    { id: 1515492, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Nea Ionia'       },
    { id: 2130792, cap: 50,  kwhPrice: 0.62, locationName: 'bluePlug · Peristeri'       },
  ],
  redPlug: [
    { id: 3835968, cap: 50,  kwhPrice: 0.44, locationName: 'nrg · Shell Papandreou'     },
    { id: 3855144, cap: 22,  kwhPrice: 0.38, locationName: 'EVziiin · Fortisi Athina'   },
    { id: 3842364, cap: 22,  kwhPrice: 0.42, locationName: 'DEI Blue · Sklavenitis'     },
    { id: 3855639, cap: 50,  kwhPrice: 0.50, locationName: 'redPlug · Lidl Petroupoli'  },
    { id: 3865347, cap: 60,  kwhPrice: 0.55, locationName: 'nrg · Shell Perama'         },
    { id: 3874101, cap: 50,  kwhPrice: 0.48, locationName: 'redPlug · BP Liosion'       },
    { id: 3880200, cap: 22,  kwhPrice: 0.40, locationName: 'redPlug · Halandri'         },
    { id: 3890415, cap: 100, kwhPrice: 0.56, locationName: 'nrg · Kifisias HPC'         },
    { id: 3900122, cap: 22,  kwhPrice: 0.42, locationName: 'DEI Blue · Kallithea'       },
    { id: 3910550, cap: 50,  kwhPrice: 0.50, locationName: 'redPlug · Moschato'         },
  ],
  greenPlug: [
    { id: 539191,  cap: 22,  kwhPrice: 0.273, locationName: 'greenPlug · Omonia'        },
    { id: 1012363, cap: 50,  kwhPrice: 0.354, locationName: 'greenPlug · Marousi'       },
    { id: 1515487, cap: 22,  kwhPrice: 0.283, locationName: 'greenPlug · Kallithea'     },
    { id: 539192,  cap: 7,   kwhPrice: 0.252, locationName: 'greenPlug · Home Charger'  },
    { id: 1012364, cap: 22,  kwhPrice: 0.325, locationName: 'greenPlug · Chalandri'     },
    { id: 539200,  cap: 50,  kwhPrice: 0.362, locationName: 'greenPlug · Piraeus HPC'   },
    { id: 1012370, cap: 22,  kwhPrice: 0.291, locationName: 'greenPlug · Nea Smyrni'    },
    { id: 1515495, cap: 22,  kwhPrice: 0.278, locationName: 'greenPlug · Glyfada'       },
    { id: 539205,  cap: 11,  kwhPrice: 0.265, locationName: 'greenPlug · Kifisia Slow'  },
    { id: 1012380, cap: 100, kwhPrice: 0.395, locationName: 'greenPlug · Maroussi DC'   },
  ],
};

// Weighted provider selection: bluePlug 40 %, redPlug 35 %, greenPlug 25 %
function pickProvider() {
  const r = rand() * 100;
  if (r < 40) return 'bluePlug';
  if (r < 75) return 'redPlug';
  return 'greenPlug';
}

// ── Generate reservations in memory ─────────────────────────────────────────
const START_MS   = new Date('2024-06-15T00:00:00.000Z').getTime();
const DAY_MS     = 86400000;
const TOTAL_DAYS = 730; // 2024-06-15 → 2026-06-14

const reservations  = [];
const analyticsAcc  = {}; // key: "providerName|YYYY-MM"
let resId = 1;

for (let day = 0; day < TOTAL_DAYS; day++) {
  const count = randInt(3, 7);
  for (let i = 0; i < count; i++) {
    const providerName    = pickProvider();
    const charger         = pickItem(CHARGERS[providerName]);
    const durationMin     = randInt(10, 60);
    const durationSec     = durationMin * 60;
    const energyKwh       = parseFloat(((durationSec / 3600) * charger.cap).toFixed(4));
    const totalCost       = parseFloat((energyKwh * charger.kwhPrice).toFixed(2));
    const userId          = randInt(1, 100);
    const hour            = randInt(6, 22);
    const minute          = randInt(0, 59);
    const createdAt       = new Date(START_MS + day * DAY_MS + hour * 3600000 + minute * 60000);
    const period          = createdAt.toISOString().slice(0, 7);

    reservations.push({
      reservationId:         resId++,
      userId,
      chargerId:             charger.id,
      locationName:          charger.locationName,
      capacityKw:            charger.cap,
      providerName,
      duration:              durationMin,
      actualDurationSeconds: durationSec,
      kwhPrice:              charger.kwhPrice,
      status:                'completed',
      createdAt,
      updatedAt:             new Date(createdAt.getTime() + durationSec * 1000),
    });

    const key = `${providerName}|${period}`;
    if (!analyticsAcc[key]) {
      analyticsAcc[key] = { providerName, period, totalReservations: 0, totalDurationMinutes: 0, totalEnergyKwh: 0, totalRevenue: 0 };
    }
    analyticsAcc[key].totalReservations    += 1;
    analyticsAcc[key].totalDurationMinutes += durationSec / 60;
    analyticsAcc[key].totalEnergyKwh       += energyKwh;
    analyticsAcc[key].totalRevenue         += totalCost;
  }
}

// Round analytics accumulators
const statDocs = Object.values(analyticsAcc).map(s => ({
  providerName:         s.providerName,
  period:               s.period,
  totalReservations:    s.totalReservations,
  totalDurationMinutes: parseFloat(s.totalDurationMinutes.toFixed(2)),
  totalEnergyKwh:       parseFloat(s.totalEnergyKwh.toFixed(4)),
  totalRevenue:         parseFloat(s.totalRevenue.toFixed(2)),
  createdAt:            new Date(),
  updatedAt:            new Date(),
}));

// Invoice docs — one per (providerName, period) pair, matching the fee formula
// used by billing-service/src/services/invoice.service.js.
const COMMISSION_RATE = 0.10;
const FEE_PER_SESSION = 0.30;
const invoiceDocs = Object.values(analyticsAcc)
  .sort((a, b) => a.period.localeCompare(b.period) || a.providerName.localeCompare(b.providerName))
  .map((stat, idx) => {
    const totalSessions    = stat.totalReservations;
    const totalRevenue     = parseFloat(stat.totalRevenue.toFixed(2));
    const commissionAmount = Math.round(totalRevenue * COMMISSION_RATE * 100) / 100;
    const sessionFee       = Math.round(totalSessions * FEE_PER_SESSION * 100) / 100;
    const totalDue         = Math.round((commissionAmount + sessionFee) * 100) / 100;
    return {
      invoiceId:        idx + 1,
      providerName:     stat.providerName,
      period:           stat.period,
      totalSessions,
      totalRevenue,
      commissionRate:   COMMISSION_RATE,
      commissionAmount,
      feePerSession:    FEE_PER_SESSION,
      sessionFee,
      totalDue,
      status:           'pending',
      generatedAt:      new Date(),
    };
  });

// BilledReservation docs for billing-db.
// totalCost reuses the same two-step rounding as the reservation loop
// (energyKwh rounded to 4dp first, then multiplied by kwhPrice) so both
// collections are always consistent and analytics revenue sums reconcile.
const billedDocs = reservations.map(r => ({
  reservationId:           r.reservationId,
  userId:                  r.userId,
  chargerId:               r.chargerId,
  locationName:            r.locationName,
  capacityKw:              r.capacityKw,
  providerName:            r.providerName,
  kwhPrice:                r.kwhPrice,
  originalDurationMinutes: r.duration,                   // r.duration is already in minutes
  status:                  'completed',
  actualDurationSeconds:   r.actualDurationSeconds,      // r.actualDurationSeconds is in seconds
  totalCost:               parseFloat((parseFloat(((r.actualDurationSeconds / 3600) * r.capacityKw).toFixed(4)) * r.kwhPrice).toFixed(2)),
  createdAt:               r.createdAt,
}));

// ── Write to DBs ─────────────────────────────────────────────────────────────
async function run() {
  const [resConn, anlConn, bilConn] = await Promise.all([
    mongoose.createConnection('mongodb://reservation-db:27017/reservation').asPromise(),
    mongoose.createConnection('mongodb://analytics-db:27017/analytics').asPromise(),
    mongoose.createConnection('mongodb://billing-db:27017/billing').asPromise(),
  ]);

  try {
    // reservation-db
    await resConn.db.collection('reservations').drop().catch(() => {});
    await resConn.db.collection('counters').drop().catch(() => {});
    await resConn.db.collection('reservations').insertMany(reservations);
    await resConn.db.collection('counters').insertOne({ name: 'reservationId', value: resId - 1 });
    console.log(`  reservation-db : ${reservations.length} reservations, counter → ${resId - 1}`);

    // analytics-db
    await anlConn.db.collection('analyticstats').drop().catch(() => {});
    await anlConn.db.collection('analyticstats').insertMany(statDocs);
    console.log(`  analytics-db   : ${statDocs.length} provider-period stat documents`);

    // billing-db — full reset: billedreservations, invoices, and counter
    await bilConn.db.collection('billedreservations').drop().catch(() => {});
    await bilConn.db.collection('invoices').drop().catch(() => {});
    await bilConn.db.collection('counters').drop().catch(() => {});
    await bilConn.db.collection('billedreservations').insertMany(billedDocs);
    await bilConn.db.collection('invoices').insertMany(invoiceDocs);
    await bilConn.db.collection('counters').insertOne({ _id: 'invoiceId', seq: invoiceDocs.length });
    console.log(`  billing-db     : ${billedDocs.length} BilledReservation snapshots, ${invoiceDocs.length} invoices`);

    console.log(`Done. Date range: 2024-06-15 → 2026-06-14 (${TOTAL_DAYS} days)`);
  } finally {
    await Promise.all([resConn.close(), anlConn.close(), bilConn.close()]);
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
