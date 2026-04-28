import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../test/setup.js";

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
  // Ensure unique indexes are built before tests rely on them.
  const { Department } = await import("./department.model.js");
  await Department.init();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe("Department model", () => {
  it("creates with name + code, lowercases code", async () => {
    const { Department } = await import("./department.model.js");
    const d = await Department.create({ name: "Engineering", code: "ENG" });
    expect(d.name).toBe("Engineering");
    expect(d.code).toBe("eng");
  });

  it("rejects duplicate name", async () => {
    const { Department } = await import("./department.model.js");
    await Department.create({ name: "HR", code: "hr" });
    await expect(Department.create({ name: "HR", code: "hr2" })).rejects.toThrow();
  });

  it("rejects duplicate code", async () => {
    const { Department } = await import("./department.model.js");
    await Department.create({ name: "Eng", code: "eng" });
    await expect(Department.create({ name: "Engineering 2", code: "ENG" })).rejects.toThrow();
  });

  it("rejects code with disallowed chars", async () => {
    const { Department } = await import("./department.model.js");
    await expect(Department.create({ name: "Bad", code: "Has Spaces" })).rejects.toThrow();
  });
});
