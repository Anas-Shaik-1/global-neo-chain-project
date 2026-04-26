import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";

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

describe("validate middleware", () => {
  it("attaches parsed data to req.validated and passes through", async () => {
    const { validate } = await import("./validate.js");
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.use(express.json());
    const schema = z.object({ name: z.string() });
    app.post("/", validate(schema), (req, res) => res.json({ data: req.validated }));
    app.use(errorHandler);
    const res = await request(app).post("/").send({ name: "Ana" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { name: "Ana" } });
  });

  it("returns 400 with VALIDATION code on bad body", async () => {
    const { validate } = await import("./validate.js");
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.use(express.json());
    const schema = z.object({ age: z.number() });
    app.post("/", validate(schema), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const res = await request(app).post("/").send({ age: "not-a-number" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.details).toBeDefined();
  });
});
