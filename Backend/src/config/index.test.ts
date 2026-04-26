import { describe, it, expect, beforeEach, afterEach } from "vitest";

const REQUIRED = {
  PORT: "3000",
  MONGO_URI: "mongodb://localhost:27017/ems-test",
  FRONTEND_ORIGIN: "http://localhost:5173",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "7d",
  SEED_ADMIN_EMAIL: "admin@example.com",
  SEED_ADMIN_PASSWORD: "Strong-Pass-1!",
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
};

describe("config", () => {
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    saved = { ...process.env };
  });

  afterEach(() => {
    process.env = saved;
  });

  it("parses a valid environment", async () => {
    Object.assign(process.env, REQUIRED);
    const { loadConfig } = await import("./index.js");
    const cfg = loadConfig();
    expect(cfg.PORT).toBe(3000);
    expect(cfg.MONGO_URI).toBe(REQUIRED.MONGO_URI);
    expect(cfg.NODE_ENV).toBe("test");
  });

  it("throws when a required secret is missing", async () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.JWT_ACCESS_SECRET;
    const { loadConfig } = await import("./index.js");
    expect(() => loadConfig()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects a JWT secret shorter than 32 characters", async () => {
    Object.assign(process.env, REQUIRED, { JWT_ACCESS_SECRET: "short" });
    const { loadConfig } = await import("./index.js");
    expect(() => loadConfig()).toThrow();
  });
});
