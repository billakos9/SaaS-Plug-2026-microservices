// Seed data to auth + user DBs for development purposes.

import { readFile } from "node:fs/promises";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

const AUTH_MONGOOSE_URL =
  process.env.AUTH_MONGOOSE_URL ?? "mongodb://auth-db:27017/auth";
const USER_MONGOOSE_URL =
  process.env.USER_MONGOOSE_URL ?? "mongodb://user-db:27017/user";
const MOCK_USERS_FILE =
  process.env.MOCK_USERS_FILE ?? new URL("../mock_data/users.json", import.meta.url);
const allowedRoles = new Set(["user", "provider", "admin"]);

if (process.env.NODE_ENV === "production") {
  throw new Error("Dev seeder cannot run in production");
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
      username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      firstName: {
        type: String,
        default: null,
      },
      lastName: {
        type: String,
        default: null,
      },
      birthdate: {
        type: Date,
        default: null,
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

function requireText(value, fieldName, position) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`mock user #${position} needs a non-empty ${fieldName}`);
  }

  return value.trim();
}

function normalizeSeedUser(rawUser, position) {
  const userId = Number(rawUser.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`mock user #${position} has invalid userId`);
  }

  const email = requireText(rawUser.email, "email", position).toLowerCase();
  const password = requireText(rawUser.password, "password", position);
  const name = requireText(rawUser.name, "name", position);
  const phoneNumber =
    rawUser.phoneNumber === null || rawUser.phoneNumber === undefined
      ? null
      : requireText(rawUser.phoneNumber, "phoneNumber", position);
  const role = rawUser.role ?? "user";

  if (!allowedRoles.has(role)) {
    throw new Error(`mock user #${position} has invalid role`);
  }

  // Optional enrichment fields — omit entirely when absent (sparse index safety)
  const username   = rawUser.username   ? String(rawUser.username).trim()   : undefined;
  const firstName  = rawUser.firstName  ? String(rawUser.firstName).trim()  : null;
  const lastName   = rawUser.lastName   ? String(rawUser.lastName).trim()   : null;
  const birthdate  = rawUser.birthdate  ? new Date(rawUser.birthdate)        : null;

  return {
    userId,
    email,
    password,
    username,
    name,
    firstName,
    lastName,
    birthdate,
    phoneNumber,
    role,
  };
}

function assertNoDuplicates(users, fieldName) {
  const seen = new Set();

  for (const user of users) {
    const value = user[fieldName];

    if (seen.has(value)) {
      throw new Error(`Duplicate ${fieldName} in mock users: ${value}`);
    }

    seen.add(value);
  }
}

async function loadMockUsers() {
  const fileContents = await readFile(MOCK_USERS_FILE, "utf8");
  const parsedUsers = JSON.parse(fileContents);

  if (!Array.isArray(parsedUsers) || parsedUsers.length === 0) {
    throw new Error("mock_data/users.json must contain a non-empty array");
  }

  const users = parsedUsers.map((user, index) =>
    normalizeSeedUser(user, index + 1),
  );

  assertNoDuplicates(users, "userId");
  assertNoDuplicates(users, "email");
  const withUsername = users.filter((u) => u.username !== undefined);
  assertNoDuplicates(withUsername, "username");

  return users;
}

async function createPasswordHashes(users) {
  const passwordHashByPlainPassword = new Map();

  for (const user of users) {
    if (!passwordHashByPlainPassword.has(user.password)) {
      passwordHashByPlainPassword.set(
        user.password,
        await bcrypt.hash(user.password, 10),
      );
    }
  }

  return passwordHashByPlainPassword;
}

async function seed() {
  await Promise.all([authConnection.asPromise(), userConnection.asPromise()]);

  const users = await loadMockUsers();
  const passwordHashByPlainPassword = await createPasswordHashes(users);
  const maxSeedUserId = Math.max(...users.map((user) => user.userId));

  await AuthUser.bulkWrite(
    users.map((user) => ({
      updateOne: {
        filter: { userId: user.userId },
        update: {
          $set: {
            email: user.email,
            passwordHash: passwordHashByPlainPassword.get(user.password),
            role: user.role,
          },
        },
        upsert: true,
      },
    })),
  );

  await User.bulkWrite(
    users.map((user) => {
      const setFields = {
        email:       user.email,
        name:        user.name,
        firstName:   user.firstName,
        lastName:    user.lastName,
        birthdate:   user.birthdate,
        phoneNumber: user.phoneNumber,
        role:        user.role,
      };
      // username uses a sparse unique index — omit the key entirely when absent
      if (user.username !== undefined) setFields.username = user.username;
      return {
        updateOne: {
          filter: { userId: user.userId },
          update: { $set: setFields },
          upsert: true,
        },
      };
    }),
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

  console.log(`Seeded ${users.length} users in auth-db and user-db.`);
}

try {
  await seed();
} finally {
  await Promise.all([authConnection.close(), userConnection.close()]);
}
