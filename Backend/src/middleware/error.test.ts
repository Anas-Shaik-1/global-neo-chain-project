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

describe("error middleware", () => {
  it("renders AppError with code+message+details", async () => {
    const { errorHandler } = await import("./error.js");
    const { NotFoundError } = await import("../lib/errors.js");
    const app = express();
    app.get("/", (_req, _res, next) => next(new NotFoundError("widget")));
    app.use(errorHandler);
    const res = await request(app).get("/");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "NOT_FOUND", message: "widget not found" });
  });

  it("renders unknown errors as 500 INTERNAL", async () => {
    const { errorHandler } = await import("./error.js");
    const app = express();
    app.get("/", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);
    const res = await request(app).get("/");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
  });
});
