import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

beforeAll(async () => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
  await startTestDb();
  // Build indexes for User unique-email lookups
  const { User } = await import("../../models/user.model.js");
  await User.init();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function seedUser(role: "ADMIN" | "HR" | "EMPLOYEE" | "PM" = "EMPLOYEE", overrides: Record<string, unknown> = {}) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email: `u${Math.random()}@b.com`,
    passwordHash: await bcrypt.hash("pw", 4),
    name: "U",
    role,
    dateOfBirth: new Date("1990-01-01"),
    address: "secret",
    ...overrides,
  });
}

describe("employees.service projection helpers", () => {
  it("toPublicProfile strips sensitive fields", async () => {
    const u = await seedUser();
    const { toPublicProfile } = await import("./employees.service.js");
    const p = toPublicProfile(u, null);
    expect((p as Record<string, unknown>).dateOfBirth).toBeUndefined();
    expect((p as Record<string, unknown>).address).toBeUndefined();
    expect(p.email).toBe(u.email);
    expect(p.role).toBe("EMPLOYEE");
  });

  it("toFullProfile includes sensitive fields", async () => {
    const u = await seedUser();
    const { toFullProfile } = await import("./employees.service.js");
    const f = toFullProfile(u, null);
    expect(f.dateOfBirth).toBeDefined();
    expect(f.address).toBe("secret");
  });

  it("canSeeFullProfile: HR yes, ADMIN yes, EMPLOYEE only on self", async () => {
    const { canSeeFullProfile } = await import("./employees.service.js");
    const me = new Types.ObjectId().toString();
    const other = new Types.ObjectId().toString();
    expect(canSeeFullProfile({ id: me, role: "HR" }, other)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "ADMIN" }, other)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, other)).toBe(false);
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, me)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "PM" }, other)).toBe(false);
  });
});

describe("employees.service create", () => {
  it("createEmployee creates user with random password and returns full profile + temp password", async () => {
    const { createEmployee } = await import("./employees.service.js");
    const out = await createEmployee({ email: "n@b.com", name: "New", role: "EMPLOYEE" });
    expect(out.profile.email).toBe("n@b.com");
    expect(out.tempPassword).toMatch(/.{16,}/);
  });

  it("createEmployee on duplicate email throws ConflictError", async () => {
    const { createEmployee } = await import("./employees.service.js");
    await createEmployee({ email: "dupe@b.com", name: "A", role: "EMPLOYEE" });
    await expect(createEmployee({ email: "dupe@b.com", name: "B", role: "EMPLOYEE" })).rejects.toThrow();
  });
});

describe("employees.service positions", () => {
  it("addPosition with no prior open position just creates", async () => {
    const u = await seedUser();
    const { addPosition } = await import("./employees.service.js");
    const p = await addPosition(u._id.toString(), {
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-01-01"),
    });
    expect(p.endedAt).toBeNull();
  });

  it("addPosition auto-ends prior open position", async () => {
    const u = await seedUser();
    const { addPosition } = await import("./employees.service.js");
    const { Position } = await import("../../models/position.model.js");
    await addPosition(u._id.toString(), {
      title: "Old",
      employmentType: "FULL_TIME",
      startedAt: new Date("2023-01-01"),
    });
    await addPosition(u._id.toString(), {
      title: "New",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-06-01"),
    });
    const positions = await Position.find({ userId: u._id }).sort({ startedAt: 1 });
    expect(positions.length).toBe(2);
    expect(positions[0]!.endedAt).toBeInstanceOf(Date);
    expect(positions[1]!.endedAt).toBeNull();
  });
});

describe("employees.service deactivate", () => {
  it("deactivate sets isActive=false and ends open position", async () => {
    const u = await seedUser();
    const { addPosition, deactivate } = await import("./employees.service.js");
    const { Position } = await import("../../models/position.model.js");
    const { User } = await import("../../models/user.model.js");
    await addPosition(u._id.toString(), {
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2023-01-01"),
    });
    await deactivate(u._id.toString());
    const fresh = await User.findById(u._id);
    expect(fresh?.isActive).toBe(false);
    const open = await Position.find({ userId: u._id, endedAt: null });
    expect(open.length).toBe(0);
  });
});
