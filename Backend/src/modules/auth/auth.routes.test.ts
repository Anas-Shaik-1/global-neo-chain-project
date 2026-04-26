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
});

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

async function seedAdmin() {
  const { User } = await import("../../models/user.model.js");
  await User.create({
    email: "admin@sms-ip.local",
    passwordHash: await bcrypt.hash("ChangeMe-Admin-1!", 4),
    name: "Admin",
    role: "ADMIN",
  });
}

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

describe("/auth routes", () => {
  it("POST /auth/login returns access + sets refresh cookie", async () => {
    await seedAdmin();
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe("admin@sms-ip.local");
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toMatch(/^refresh=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Path=\/auth/i);
  });

  it("POST /auth/login returns 401 on bad password", async () => {
    await seedAdmin();
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("POST /auth/login returns 400 on validation error", async () => {
    const app = await buildApp();
    const res = await request(app).post("/auth/login").send({ email: "not-email" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("POST /auth/refresh rotates the cookie and returns new access", async () => {
    await seedAdmin();
    const app = await buildApp();
    const agent = request.agent(app);
    await agent.post("/auth/login").send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const res = await agent.post("/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^refresh=/);
  });

  it("reusing a stale refresh cookie returns 401", async () => {
    await seedAdmin();
    const app = await buildApp();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const stale = login.headers["set-cookie"];
    await request(app).post("/auth/refresh").set("Cookie", stale);
    const reuse = await request(app).post("/auth/refresh").set("Cookie", stale);
    expect(reuse.status).toBe(401);
  });

  it("GET /auth/me requires bearer", async () => {
    const app = await buildApp();
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /auth/me returns user with bearer", async () => {
    await seedAdmin();
    const app = await buildApp();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@sms-ip.local");
  });

  it("POST /auth/logout returns 204 and revokes the family", async () => {
    await seedAdmin();
    const app = await buildApp();
    const login = await request(app)
      .post("/auth/login")
      .send({ email: "admin@sms-ip.local", password: "ChangeMe-Admin-1!" });
    const cookie = login.headers["set-cookie"];
    const out = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(204);
    const reuse = await request(app).post("/auth/refresh").set("Cookie", cookie);
    expect(reuse.status).toBe(401);
  });
});
