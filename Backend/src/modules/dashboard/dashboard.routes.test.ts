import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import request from "supertest";
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

describe("/dashboard", () => {
  it("GET /dashboard/admin by EMPLOYEE returns 403", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .get("/dashboard/admin")
      .set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(403);
  });

  it("GET /dashboard/admin by ADMIN returns 200 with admin shape", async () => {
    const a = await seedAndToken("ADMIN", "admin@b.com");
    const app = await buildApp();
    const res = await request(app)
      .get("/dashboard/admin")
      .set("Authorization", `Bearer ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalEmployees");
    expect(res.body).toHaveProperty("departmentCount");
    expect(res.body).toHaveProperty("openTasks");
    expect(res.body).toHaveProperty("pendingExpenses");
    expect(Array.isArray(res.body.recentJoiners)).toBe(true);
  });

  it("GET /dashboard/me by EMPLOYEE returns 200 with own stats", async () => {
    const e = await seedAndToken("EMPLOYEE", "e@b.com");
    const app = await buildApp();
    const res = await request(app)
      .get("/dashboard/me")
      .set("Authorization", `Bearer ${e.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("myOpenTasks", 0);
    expect(res.body).toHaveProperty("myPendingExpenses", 0);
    expect(res.body).toHaveProperty("latestPayslip", null);
    expect(res.body).toHaveProperty("unreadMessages", 0);
  });
});
