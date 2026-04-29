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
    const entry = await clockIn(userId, { notes: "starting day" });
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

  it("clockOut within 1hr throws ConflictError", async () => {
    const { Attendance } = await import("../../models/attendance.model.js");
    const { clockOut } = await import("./attendance.service.js");
    const { ConflictError } = await import("../../lib/errors.js");
    const userId = new Types.ObjectId();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const now = new Date();
    const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    await Attendance.create({
      userId,
      date,
      clockIn: tenMinAgo,
      clockOut: null,
    });
    await expect(clockOut(userId.toString())).rejects.toBeInstanceOf(ConflictError);
  });

  it("clockOut after 1hr+ subtracts lunch break from durationMinutes", async () => {
    const { Attendance } = await import("../../models/attendance.model.js");
    const { clockOut } = await import("./attendance.service.js");
    const userId = new Types.ObjectId();
    const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000);
    const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const now = new Date();
    const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    await Attendance.create({
      userId,
      date,
      clockIn: ninetyMinAgo,
      lunchStart: sixtyMinAgo,
      lunchEnd: thirtyMinAgo,
      clockOut: null,
    });
    const result = await clockOut(userId.toString());
    expect(result.lunchMinutes).toBe(30);
    // 90 - 30 = 60, allow ±1 minute slack
    expect(result.durationMinutes).toBeGreaterThanOrEqual(59);
    expect(result.durationMinutes).toBeLessThanOrEqual(61);
  });

  it("startLunch + endLunch happy path", async () => {
    const { Attendance } = await import("../../models/attendance.model.js");
    const { startLunch, endLunch } = await import("./attendance.service.js");
    const userId = new Types.ObjectId();
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const now = new Date();
    const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    await Attendance.create({
      userId,
      date,
      clockIn: fifteenMinAgo,
      clockOut: null,
    });
    const started = await startLunch(userId.toString());
    expect(started.lunchStart).not.toBeNull();
    expect(started.lunchEnd).toBeNull();
    const ended = await endLunch(userId.toString());
    expect(ended.lunchEnd).not.toBeNull();
  });

  it("startLunch when no clock-in throws NotFoundError", async () => {
    const { startLunch } = await import("./attendance.service.js");
    const { NotFoundError } = await import("../../lib/errors.js");
    const userId = new Types.ObjectId().toString();
    await expect(startLunch(userId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("clockIn with isRemote=true persists flag", async () => {
    const { clockIn } = await import("./attendance.service.js");
    const userId = new Types.ObjectId().toString();
    const entry = await clockIn(userId, { isRemote: true });
    expect(entry.isRemote).toBe(true);
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
