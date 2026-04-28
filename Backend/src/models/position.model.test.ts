import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Types } from "mongoose";
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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe("Position model", () => {
  it("creates open position (endedAt null)", async () => {
    const { Position } = await import("./position.model.js");
    const userId = new Types.ObjectId();
    const p = await Position.create({
      userId,
      title: "Engineer",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-01-01"),
    });
    expect(p.endedAt).toBe(null);
    expect(p.title).toBe("Engineer");
  });

  it("rejects invalid employmentType", async () => {
    const { Position } = await import("./position.model.js");
    await expect(
      Position.create({
        userId: new Types.ObjectId(),
        title: "X",
        employmentType: "FREELANCE" as never,
        startedAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});
