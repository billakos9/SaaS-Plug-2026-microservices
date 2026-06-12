/**
 * seed-stats.js
 * Run inside reservation_service container:
 *   docker exec reservation_service node /tmp/seed-stats.js
 *
 * Wipes reservation-db and analytics-db, then inserts 100 completed
 * reservations spread across the 3 providers and rebuilds analytics stats.
 */

'use strict';

const mongoose = require('/saas26-09/node_modules/mongoose');

const CHARGERS = {
  bluePlug: [
    { id: 1285757, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Syntagma Sq.'   },
    { id: 2130785, cap: 50,  kwhPrice: 0.59, locationName: 'bluePlug · Kifisias Ave.'  },
    { id: 1515488, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Glyfada'        },
    { id: 1285758, cap: 100, kwhPrice: 0.59, locationName: 'bluePlug · Airport Fast'   },
    { id: 2130786, cap: 22,  kwhPrice: 0.59, locationName: 'bluePlug · Piraeus'        },
    { id: 1515490, cap: 50,  kwhPrice: 0.59, locationName: 'bluePlug · Kolonaki'       },
  ],
  redPlug: [
    { id: 3835968, cap: 50, kwhPrice: 0.44, locationName: 'nrg · Shell Papandreou'     },
    { id: 3855144, cap: 22, kwhPrice: 0.38, locationName: 'EVziiin · Φόρτισης Αθήνα'  },
    { id: 3842364, cap: 22, kwhPrice: 0.42, locationName: 'DEI Blue · Sklavenitis'     },
    { id: 3855639, cap: 50, kwhPrice: 0.50, locationName: 'redPlug · Lidl Petroupoli'  },
    { id: 3865347, cap: 60, kwhPrice: 0.55, locationName: 'nrg · Shell Perama'         },
    { id: 3874101, cap: 50, kwhPrice: 0.48, locationName: 'BP Λιοσίων'                },
  ],
  greenPlug: [
    { id: 539191,  cap: 22, kwhPrice: 0.273, locationName: 'greenPlug · Omonia'       },
    { id: 1012363, cap: 50, kwhPrice: 0.354, locationName: 'greenPlug · Marousi'      },
    { id: 1515487, cap: 22, kwhPrice: 0.283, locationName: 'greenPlug · Kallithea'    },
    { id: 539192,  cap: 7,  kwhPrice: 0.252, locationName: 'greenPlug · Home Charger' },
    { id: 1012364, cap: 22, kwhPrice: 0.325, locationName: 'greenPlug · Chalandri'    },
  ],
};

// 40 bluePlug · 35 redPlug · 25 greenPlug = 100 sessions
const COUNTS = { bluePlug: 40, redPlug: 35, greenPlug: 25 };

const PERIOD = new Date().toISOString().slice(0, 7); // e.g. "2026-06"

function rand(min, max)  { return Math.random() * (max - min) + min; }
function pick(arr)        { return arr[Math.floor(Math.random() * arr.length)]; }
function round2(n)        { return Math.round(n * 100) / 100; }

async function run() {
  const resConn = await mongoose.createConnection('mongodb://reservation-db:27017/reservation').asPromise();
  const anlConn = await mongoose.createConnection('mongodb://analytics-db:27017/analytics').asPromise();

  // ── Clear existing data ───────────────────────────────────────────────────
  const rDel = await resConn.db.collection('reservations').deleteMany({});
  const cDel = await resConn.db.collection('counters').deleteMany({});
  const aDel = await anlConn.db.collection('analyticstats').deleteMany({});
  console.log(`  Cleared: ${rDel.deletedCount} reservations, ${cDel.deletedCount} counters, ${aDel.deletedCount} stats`);

  // ── Build 100 reservations ────────────────────────────────────────────────
  const reservations = [];
  const acc = {};
  let id = 1;

  for (const [provider, count] of Object.entries(COUNTS)) {
    acc[provider] = { totalReservations: 0, totalDurationMinutes: 0, totalEnergyKwh: 0, totalRevenue: 0 };

    for (let i = 0; i < count; i++) {
      const charger      = pick(CHARGERS[provider]);
      const durationSec  = Math.round(rand(900, 10800));        // 15 min – 3 hrs
      const durationHrs  = durationSec / 3600;
      const energyKwh    = durationHrs * charger.cap;
      const revenue      = energyKwh * charger.kwhPrice;
      const msAgo        = rand(0, 28 * 86400 * 1000);          // within last 28 days
      const createdAt    = new Date(Date.now() - msAgo);
      const updatedAt    = new Date(createdAt.getTime() + durationSec * 1000);

      reservations.push({
        reservationId: id++,
        userId:        Math.ceil(rand(1, 100)),
        chargerId:     charger.id,
        locationName:  charger.locationName,
        capacityKw:    charger.cap,
        providerName:  provider,
        duration:      durationSec,
        kwhPrice:      charger.kwhPrice,
        status:        'completed',
        createdAt,
        updatedAt,
      });

      acc[provider].totalReservations    += 1;
      acc[provider].totalDurationMinutes += durationSec / 60;
      acc[provider].totalEnergyKwh       += energyKwh;
      acc[provider].totalRevenue         += revenue;
    }
  }

  await resConn.db.collection('reservations').insertMany(reservations);
  await resConn.db.collection('counters').insertOne({ name: 'reservationId', value: id - 1 });
  console.log(`  Inserted ${reservations.length} completed reservations (counter → ${id - 1})`);

  // ── Write analytics stats ─────────────────────────────────────────────────
  for (const [providerName, stats] of Object.entries(acc)) {
    const doc = {
      providerName,
      period:               PERIOD,
      totalReservations:    stats.totalReservations,
      totalDurationMinutes: round2(stats.totalDurationMinutes),
      totalEnergyKwh:       round2(stats.totalEnergyKwh),
      totalRevenue:         round2(stats.totalRevenue),
      updatedAt:            new Date(),
    };
    await anlConn.db.collection('analyticstats').updateOne(
      { providerName, period: PERIOD },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    console.log(`  ${providerName}: ${doc.totalReservations} sessions | ${doc.totalEnergyKwh} kWh | €${doc.totalRevenue}`);
  }

  await resConn.close();
  await anlConn.close();
  console.log(`Done: stats seeded for period ${PERIOD}.`);
}

run().catch(e => { console.error(e.message); process.exit(1); });
