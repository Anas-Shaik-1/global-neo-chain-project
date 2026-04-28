import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
  const { Attendance } = await import("../../models/attendance.model.js");
  await Attendance.init();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

describe("attendance.service", () => {
  it("clockIn creates a new entry for today", async () => {
    const { clockIn } = await import("./attendance.service.js");
    const userId = new Types.ObjectId().toString();
    const entry = await clockIn(userId, "starting day");
    expect(entry.userId).toBe(userId);
    expect(entry.clockOut).toBeNull();
    expect(entry.durationMinutes).toBeNull();
    expect(entry.notes).toBe("starting day");
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("clockIn twice in the same day throws ConflictError", async () => {
    const { clockIn } = await import("./attendance.service.js");
    const { ConflictError } = await import("../../lib/errors.js");
    const userId = new Types.ObjectId().toString();
    await clockIn(userId);
    await expect(clockIn(userId)).rejects.toBeInstanceOf(ConflictError);
  });

  it("clockOut without prior clockIn throws NotFoundError", async () => {
    const { clockOut } = await import("./attendance.service.js");
    const { NotFoundError } = await import("../../lib/errors.js");
    const userId = new Types.ObjectId().toString();
    await expect(clockOut(userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("myMonth aggregates totalMinutes and daysWorked correctly", async () => {
    const { Attendance } = await import("../../models/attendance.model.js");
    const { myMonth } = await import("./attendance.service.js");
    const userId = new Types.ObjectId();

    // Use a stable past month so the test isn't sensitive to "today" rollovers.
    const month = "2024-06";
    // Day 1: 9:00 -> 17:00 = 480 minutes
    await Attendance.create({
      userId,
      date: `${month}-03`,
      clockIn: new Date("2024-06-03T09:00:00Z"),
      clockOut: new Date("2024-06-03T17:00:00Z"),
    });
    // Day 2: 10:00 -> 12:30 = 150 minutes
    await Attendance.create({
      userId,
      date: `${month}-04`,
      clockIn: new Date("2024-06-04T10:00:00Z"),
      clockOut: new Date("2024-06-04T12:30:00Z"),
    });
    // Day 3: clocked in but not out — should not contribute
    await Attendance.create({
      userId,
      date: `${month}-05`,
      clockIn: new Date("2024-06-05T09:00:00Z"),
      clockOut: null,
    });
    // Different month entry — should be excluded
    await Attendance.create({
      userId,
      date: "2024-07-01",
      clockIn: new Date("2024-07-01T09:00:00Z"),
      clockOut: new Date("2024-07-01T17:00:00Z"),
    });

    const summary = await myMonth(userId.toString(), month);
    expect(summary.entries.length).toBe(3);
    expect(summary.daysWorked).toBe(2);
    expect(summary.totalMinutes).toBe(630);
  });
});
