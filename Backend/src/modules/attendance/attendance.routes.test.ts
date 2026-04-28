import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import request from "supertest";
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
  const { User } = await import("../../models/user.model.js");
  await User.init();
  const { Attendance } = await import("../../models/attendance.model.js");
  await Attendance.init();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

async function seedAndToken(role: "ADMIN" | "HR" | "EMPLOYEE", email: string) {
  const { User } = await import("../../models/user.model.js");
  const u = await User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
  });
  const { signAccessToken } = await import("../../lib/tokens.js");
  return {
    id: u._id.toString(),
    token: signAccessToken({ sub: u._id.toString(), role }),
  };
}

function todayUtc(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

describe("/attendance", () => {
  it("POST /attendance/clock-in returns 201 with today's date", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .post("/attendance/clock-in")
      .set("Authorization", `Bearer ${e.token}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(e.id);
    expect(res.body.date).toBe(todayUtc());
    expect(res.body.clockOut).toBeNull();
  });

  it("POST /attendance/clock-in twice returns 409", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const r1 = await request(app)
      .post("/attendance/clock-in")
      .set("Authorization", `Bearer ${e.token}`)
      .send({});
    expect(r1.status).toBe(201);
    const r2 = await request(app)
      .post("/attendance/clock-in")
      .set("Authorization", `Bearer ${e.token}`)
      .send({});
    expect(r2.status).toBe(409);
  });

  it("POST /attendance/clock-out after clock-in returns 200 with non-null durationMinutes", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const { Attendance } = await import("../../models/attendance.model.js");
    // Pre-seed a clock-in 30 minutes ago so clock-out yields a positive duration.
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    await Attendance.create({
      userId: new Types.ObjectId(e.id),
      date: todayUtc(),
      clockIn: thirtyMinAgo,
      clockOut: null,
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/attendance/clock-out")
      .set("Authorization", `Bearer ${e.token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.clockOut).toBeTruthy();
    expect(res.body.durationMinutes).toBeGreaterThanOrEqual(29);
  });

  it("GET /attendance/me?month=YYYY-MM aggregates correctly", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const { Attendance } = await import("../../models/attendance.model.js");
    const userId = new Types.ObjectId(e.id);
    const month = currentMonth();
    await Attendance.create({
      userId,
      date: `${month}-01`,
      clockIn: new Date(`${month}-01T09:00:00Z`),
      clockOut: new Date(`${month}-01T17:00:00Z`),
    });
    await Attendance.create({
      userId,
      date: `${month}-02`,
      clockIn: new Date(`${month}-02T10:00:00Z`),
      clockOut: new Date(`${month}-02T11:00:00Z`),
    });
    const app = await buildApp();
    const res = await request(app)
      .get(`/attendance/me?month=${month}`)
      .set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBe(2);
    expect(res.body.daysWorked).toBe(2);
    expect(res.body.totalMinutes).toBe(540);
  });
});
