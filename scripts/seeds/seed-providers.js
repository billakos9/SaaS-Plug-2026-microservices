/**
 * seed-providers.js
 * Run inside auth_service container:
 *   docker exec auth_service node /tmp/seed-providers.js
 *
 * Creates the 3 provider auth accounts (bluePlug / redPlug / greenPlug)
 * in auth-db and the matching provider records in provider-db.
 */

'use strict';

const mongoose = require('/saas26-09/node_modules/mongoose');
const bcrypt   = require('/saas26-09/node_modules/bcrypt');

const PROVIDERS = [
  { userId: 106, email: 'blue@plug.com',  providerName: 'bluePlug',  password: '123456' },
  { userId: 107, email: 'red@plug.com',   providerName: 'redPlug',   password: '123456' },
  { userId: 108, email: 'green@plug.com', providerName: 'greenPlug', password: '123456' },
];

const PROVIDER_RECORDS = [
  { providerId: 1, providerName: 'bluePlug',  email: 'blue@plug.com',  apiBaseUrl: 'https://davinci.softlab.ntua.gr/saas26/bluePlug/api' },
  { providerId: 2, providerName: 'redPlug',   email: 'red@plug.com',   apiBaseUrl: 'https://davinci.softlab.ntua.gr/saas26/redPlug/api'  },
  { providerId: 3, providerName: 'greenPlug', email: 'green@plug.com', apiBaseUrl: 'https://davinci.softlab.ntua.gr/saas26/greenPlug/api' },
];

async function run() {
  const authConn     = await mongoose.createConnection('mongodb://auth-db:27017/auth').asPromise();
  const providerConn = await mongoose.createConnection('mongodb://provider-db:27017/provider').asPromise();

  const hash = await bcrypt.hash('123456', 10);

  // ── Auth accounts ────────────────────────────────────────────────────────
  for (const p of PROVIDERS) {
    await authConn.db.collection('authusers').updateOne(
      { email: p.email },
      {
        $set: {
          userId:       p.userId,
          email:        p.email,
          passwordHash: hash,
          role:         'provider',
          providerName: p.providerName,
        },
      },
      { upsert: true },
    );
    console.log(`  auth-db  → ${p.email} (userId ${p.userId}, providerName ${p.providerName})`);
  }

  // Advance counter past the highest seeded userId
  await authConn.db.collection('counters').updateOne(
    { _id: 'userId' },
    { $max: { seq: 108 } },
    { upsert: true },
  );
  console.log('  auth-db counter set to 108');

  // ── Provider records ─────────────────────────────────────────────────────
  for (const r of PROVIDER_RECORDS) {
    await providerConn.db.collection('providers').updateOne(
      { providerName: r.providerName },
      {
        $set: {
          providerId:  r.providerId,
          providerName: r.providerName,
          email:       r.email,
          apiBaseUrl:  r.apiBaseUrl,
        },
      },
      { upsert: true },
    );
    console.log(`  provider-db → ${r.providerName} (id ${r.providerId})`);
  }

  // Advance provider counter
  await providerConn.db.collection('counters').updateOne(
    { _id: 'providerId' },
    { $max: { seq: 3 } },
    { upsert: true },
  );

  await authConn.close();
  await providerConn.close();
  console.log('Done: providers seeded.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
