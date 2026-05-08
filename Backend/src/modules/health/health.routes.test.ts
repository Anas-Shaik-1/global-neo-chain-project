import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { startTestDb, stopTestDb } from "../../test/setup.js";

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

describe("/health", () => {
  it("/health/live always returns 200 — process liveness only", async () => {
    const { createApp } = await import("../../app.js");
    const app = createApp();
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  describe("with mongo connected", () => {
    beforeAll(async () => {
      await startTestDb();
    });
    afterAll(async () => {
      await stopTestDb();
    });

    it("GET /health returns 200 with db:up", async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp();
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", db: "up" });
    });

    it("GET /health/ready returns 200 with db:up", async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp();
      const res = await request(app).get("/health/ready");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok", db: "up" });
    });
  });

  describe("with mongo disconnected", () => {
    it("GET /health returns 503 with db:down", async () => {
      // No startTestDb — mongoose.connection.readyState !== 1.
      const { createApp } = await import("../../app.js");
      const app = createApp();
      const res = await request(app).get("/health");
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ status: "degraded", db: "down" });
    });
  });

  it("/openapi.json exposes the spec", async () => {
    const { createApp } = await import("../../app.js");
    const app = createApp();
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe("EMS API");
    expect(res.body.paths["/auth/login"]).toBeDefined();
    expect(res.body.paths["/health"]).toBeDefined();
  });
});
