import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../test/setup.js";

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
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("User model", () => {
  it("creates a user with default role EMPLOYEE", async () => {
    const { User } = await import("./user.model.js");
    const u = await User.create({ email: "A@B.COM", passwordHash: "x", name: "A" });
    expect(u.email).toBe("a@b.com");
    expect(u.role).toBe("EMPLOYEE");
    expect(u.isVerified).toBe(false);
  });

  it("rejects duplicate emails", async () => {
    const { User } = await import("./user.model.js");
    await User.create({ email: "a@b.com", passwordHash: "x", name: "A" });
    await expect(User.create({ email: "a@b.com", passwordHash: "y", name: "B" })).rejects.toThrow();
  });

  it("rejects invalid role", async () => {
    const { User } = await import("./user.model.js");
    await expect(
      User.create({ email: "a@b.com", passwordHash: "x", name: "A", role: "BOSS" as never }),
    ).rejects.toThrow();
  });

  it("does not return passwordHash by default", async () => {
    const { User } = await import("./user.model.js");
    await User.create({ email: "a@b.com", passwordHash: "secret", name: "A" });
    const fetched = await User.findOne({ email: "a@b.com" });
    expect(fetched?.passwordHash).toBeUndefined();
  });

  it("accepts profile fields including emergencyContact subdoc", async () => {
    const { User } = await import("./user.model.js");
    const u = await User.create({
      email: "p@b.com",
      passwordHash: "x",
      name: "P",
      jobTitle: "Engineer",
      phone: "+91 555 0100",
      bio: "Builds things",
      hireDate: new Date("2024-01-15"),
      dateOfBirth: new Date("1990-05-10"),
      address: "1 Some St",
      employmentType: "FULL_TIME",
      emergencyContact: { name: "C", phone: "999", relationship: "spouse" },
    });
    expect(u.jobTitle).toBe("Engineer");
    expect(u.emergencyContact?.name).toBe("C");
    expect(u.isActive).toBe(true);
  });

  it("rejects invalid employmentType", async () => {
    const { User } = await import("./user.model.js");
    await expect(
      User.create({ email: "p2@b.com", passwordHash: "x", name: "P", employmentType: "FREELANCE" as never }),
    ).rejects.toThrow();
  });
});
