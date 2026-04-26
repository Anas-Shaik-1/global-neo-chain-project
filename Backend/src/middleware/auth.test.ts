import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

beforeAll(() => {
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
});

describe("auth + requireRole middleware", () => {
  it("rejects requests without bearer", async () => {
    const { requireAuth } = await import("./auth.js");
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
  });

  it("accepts a valid bearer and exposes req.user", async () => {
    const { requireAuth } = await import("./auth.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "ADMIN" });
    const app = express();
    app.get("/", requireAuth, (req, res) => res.json(req.user));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "u1", role: "ADMIN" });
  });

  it("requireRole allows when role matches", async () => {
    const { requireAuth } = await import("./auth.js");
    const { requireRole } = await import("./requireRole.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "ADMIN" });
    const app = express();
    app.get("/", requireAuth, requireRole("ADMIN"), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("requireRole rejects when role does not match", async () => {
    const { requireAuth } = await import("./auth.js");
    const { requireRole } = await import("./requireRole.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "EMPLOYEE" });
    const app = express();
    app.get("/", requireAuth, requireRole("ADMIN"), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("rejects bearer with role outside ROLES enum", async () => {
    const { requireAuth } = await import("./auth.js");
    const { errorHandler } = await import("./error.js");
    const { signAccessToken } = await import("../lib/tokens.js");
    const token = signAccessToken({ sub: "u1", role: "GUEST" }); // GUEST is not in ROLES
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).get("/").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
