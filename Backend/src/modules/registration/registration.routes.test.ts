import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

describe("/auth/register", () => {
  it("POST /auth/register with weak password returns 400 ValidationError", async () => {
    const app = await buildApp();
    const res = await request(app).post("/auth/register").send({
      email: "applicant@b.com",
      name: "Applicant",
      password: "weak",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });
});
