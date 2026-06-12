/**
 * seed-admins.js
 * Run inside admin_service container:
 *   docker exec admin_service node /tmp/seed-admins.js
 *
 * Creates the 3 admin accounts in admin-db and advances the counter.
 * All accounts use password: 123456
 */

'use strict';

const mongoose = require('/saas26-09/node_modules/mongoose');
const bcrypt   = require('/saas26-09/node_modules/bcryptjs');

const ADMINS = [
  { adminId: 1,  firstName: 'Super',   lastName: 'Admin',  email: 'admin@saas.com'       },
  { adminId: 33, firstName: 'Giorgos', lastName: 'Admin',  email: 'agrinios@saasplug.app' },
  { adminId: 34, firstName: 'Global',  lastName: 'Admin',  email: 'admin@saasplug.app'   },
];

async function run() {
  const conn = await mongoose.createConnection('mongodb://admin-db:27017/admin').asPromise();

  const hash = await bcrypt.hash('123456', 10);

  for (const a of ADMINS) {
    await conn.db.collection('admins').updateOne(
      { email: a.email },
      {
        $set: {
          adminId:   a.adminId,
          firstName: a.firstName,
          lastName:  a.lastName,
          email:     a.email,
          password:  hash,
        },
      },
      { upsert: true },
    );
    console.log(`  admin-db → ${a.email} (adminId ${a.adminId})`);
  }

  // Set counter to max seeded adminId so the next created admin gets id 35+
  await conn.db.collection('counters').updateOne(
    { name: 'adminId' },
    { $max: { value: 34 } },
    { upsert: true },
  );
  console.log('  admin-db counter set to 34');

  await conn.close();
  console.log('Done: admins seeded.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
