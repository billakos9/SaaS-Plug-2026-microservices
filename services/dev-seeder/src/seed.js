// seed data to auth + user db for development purposes

import bcrypt from "bcrypt";
import mongoose from "mongoose";

const AUTH_MONGOOSE_URL =
  process.env.AUTH_MONGOOSE_URL ?? "mongodb://auth-db:27017/auth";
const USER_MONGOOSE_URL =
  process.env.USER_MONGOOSE_URL ?? "mongodb://user-db:27017/user";
const SEED_COUNT = Number(process.env.SEED_COUNT ?? 100);
const SEED_START_ID = Number(process.env.SEED_START_ID ?? 1);
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "123456";
const SEED_EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN ?? "ionos.app";

if (process.env.NODE_ENV === "production") {
  throw new Error("Dev seeder cannot run in production");
}

if (!Number.isInteger(SEED_COUNT) || SEED_COUNT <= 0) {
  throw new Error("SEED_COUNT must be a positive integer");
}

if (!Number.isInteger(SEED_START_ID) || SEED_START_ID <= 0) {
  throw new Error("SEED_START_ID must be a positive integer");
}

const authConnection = mongoose.createConnection(AUTH_MONGOOSE_URL);
const userConnection = mongoose.createConnection(USER_MONGOOSE_URL);

const AuthUser = authConnection.model(
  "AuthUser",
  new mongoose.Schema({
    userId: {
      type: Number,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "provider", "admin"],
      default: "user",
    },
  }),
);

const AuthCounter = authConnection.model(
  "Counter",
  new mongoose.Schema({
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  }),
);

const User = userConnection.model(
  "User",
  new mongoose.Schema(
    {
      userId: {
        type: Number,
        required: true,
        unique: true,
      },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phoneNumber: {
        type: String,
        default: null,
      },
      role: {
        type: String,
        enum: ["user", "provider", "admin"],
        default: "user",
      },
    },
    { timestamps: true },
  ),
);

const UserCounter = userConnection.model(
  "Counter",
  new mongoose.Schema({
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  }),
);

function createSeedUser(index) {
  const padded = String(index).padStart(3, "0");

  return {
    userId: index,
    email: `seed${padded}@${SEED_EMAIL_DOMAIN}`,
    name: `Seed User ${padded}`,
    phoneNumber: `6900000${padded}`,
    role: "user",
  };
}

async function seed() {
  await Promise.all([authConnection.asPromise(), userConnection.asPromise()]);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const users = Array.from({ length: SEED_COUNT }, (unusedValue, index) =>
    createSeedUser(SEED_START_ID + index),
  );
  const maxSeedUserId = SEED_START_ID + SEED_COUNT - 1;

  await AuthUser.bulkWrite(
    users.map((user) => ({
      updateOne: {
        filter: { userId: user.userId },
        update: {
          $set: {
            email: user.email,
            passwordHash,
            role: user.role,
          },
        },
        upsert: true,
      },
    })),
  );

  await User.bulkWrite(
    users.map((user) => ({
      updateOne: {
        filter: { userId: user.userId },
        update: {
          $set: {
            email: user.email,
            name: user.name,
            phoneNumber: user.phoneNumber,
            role: user.role,
          },
        },
        upsert: true,
      },
    })),
  );

  await Promise.all([
    AuthCounter.findOneAndUpdate(
      { _id: "userId" },
      { $max: { seq: maxSeedUserId } },
      { upsert: true },
    ),
    UserCounter.findOneAndUpdate(
      { _id: "userId" },
      { $max: { seq: maxSeedUserId } },
      { upsert: true },
    ),
  ]);

  console.log(
    `Seeded ${SEED_COUNT} users in auth-db and user-db. Password: ${SEED_PASSWORD}`,
  );
}

try {
  await seed();
} finally {
  await Promise.all([authConnection.close(), userConnection.close()]);
}
