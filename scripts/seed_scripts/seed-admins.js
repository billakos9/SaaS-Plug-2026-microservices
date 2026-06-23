/**
 * seed-admins.js
 * Run inside admin_service container:
 *   docker exec admin_service node /tmp/seed-admins.js
 *
 * Creates the 3 admin accounts in admin-db AND the matching AuthUser records
 * in auth-db (so admin login works after a wipe without needing a service restart).
 * seed-providers.js must run first — it sets the auth-db userId counter to 108.
 * All accounts use password: 123456
 */

'use strict';

const mongoose = require('/saas26-09/node_modules/mongoose');
const bcrypt   = require('/saas26-09/node_modules/bcryptjs');

const ADMINS = [
  { adminId: 1,  firstName: 'Super',   lastName: 'Admin',  email: 'admin@saas.com'        },
  { adminId: 34, firstName: 'Global',  lastName: 'Admin',  email: 'admin@saasplug.app'    },
  { adminId: 33, firstName: 'Giorgos', lastName: 'Admin',  email: 'agrinios@saasplug.app' },
];

async function getNextUserId(authConn) {
  const result = await authConn.db.collection('counters').findOneAndUpdate(
    { _id: 'userId' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return result.seq;
}

async function run() {
  const [adminConn, authConn] = await Promise.all([
    mongoose.createConnection('mongodb://admin-db:27017/admin').asPromise(),
    mongoose.createConnection('mongodb://auth-db:27017/auth').asPromise(),
  ]);

  const hash = await bcrypt.hash('123456', 10);

  for (const a of ADMINS) {
    await adminConn.db.collection('admins').updateOne(
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

    // Only create auth record if it doesn't exist yet (avoids duplicate key errors
    // if auth-service migration already ran and created a record for this email).
    const existing = await authConn.db.collection('authusers').findOne({ email: a.email });
    if (!existing) {
      const userId = await getNextUserId(authConn);
      await authConn.db.collection('authusers').insertOne({
        userId,
        email:        a.email,
        passwordHash: hash,
        role:         'admin',
      });
      console.log(`  admin-db + auth-db → ${a.email} (adminId ${a.adminId}, new userId ${userId})`);
    } else {
      // Update password hash in case it changed, but keep the existing userId.
      await authConn.db.collection('authusers').updateOne(
        { email: a.email },
        { $set: { passwordHash: hash, role: 'admin' } },
      );
      console.log(`  admin-db + auth-db → ${a.email} (adminId ${a.adminId}, userId ${existing.userId} already exists)`);
    }
  }

  await adminConn.db.collection('counters').updateOne(
    { name: 'adminId' },
    { $max: { value: 34 } },
    { upsert: true },
  );
  console.log('  admin-db counter set to 34');

  await Promise.all([adminConn.close(), authConn.close()]);
  console.log('Done: admins seeded.');
}

run().catch(e => { console.error(e.message); process.exit(1); });
