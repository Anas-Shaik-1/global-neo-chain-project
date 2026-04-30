import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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

describe("registration.service", () => {
  it("register creates user with PENDING_HR status", async () => {
    const { register } = await import("./registration.service.js");
    const out = await register({
      email: "applicant@b.com",
      name: "Applicant",
      password: "Strong-Pass-1",
    });
    expect(out.email).toBe("applicant@b.com");
    expect(out.approvalStatus).toBe("PENDING_HR");
    expect(out.id).toMatch(/^[a-f0-9]{24}$/);

    const { User } = await import("../../models/user.model.js");
    const fresh = await User.findById(out.id);
    expect(fresh?.role).toBe("EMPLOYEE");
    expect(fresh?.isVerified).toBe(false);
  });

  it("register on duplicate email throws ConflictError", async () => {
    const { register } = await import("./registration.service.js");
    await register({ email: "dupe@b.com", name: "A", password: "Strong-Pass-1" });
    await expect(
      register({ email: "dupe@b.com", name: "B", password: "Strong-Pass-2" }),
    ).rejects.toThrow(/already in use/i);
  });

  it("getRegistrationStatus returns just status, not full user", async () => {
    const { register, getRegistrationStatus } = await import("./registration.service.js");
    await register({
      email: "candidate@b.com",
      name: "Candidate",
      password: "Strong-Pass-1",
    });
    const out = await getRegistrationStatus("candidate@b.com");
    expect(out).toEqual({ approvalStatus: "PENDING_HR" });
    expect(Object.keys(out)).toEqual(["approvalStatus"]);
  });
});
