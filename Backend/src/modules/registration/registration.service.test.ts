import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

let tmpRoot = "";
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "ems-reg-"));
  process.env.UPLOADS_DIR = tmpRoot;
  process.env.PUBLIC_BASE_URL = "http://test";
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const PNG_AVATAR = {
  originalName: "me.png",
  mimeType: "image/png",
  buffer: Buffer.from("PNGDATA"),
};

describe("registration.service", () => {
  it("register creates user with PENDING_HR status", async () => {
    const { register } = await import("./registration.service.js");
    const out = await register({
      email: "applicant@b.com",
      name: "Applicant",
      password: "Strong-Pass-1",
      avatar: PNG_AVATAR,
    });
    expect(out.email).toBe("applicant@b.com");
    expect(out.approvalStatus).toBe("PENDING_HR");
    expect(out.id).toMatch(/^[a-f0-9]{24}$/);

    const { User } = await import("../../models/user.model.js");
    const fresh = await User.findById(out.id);
    expect(fresh?.role).toBe("EMPLOYEE");
    expect(fresh?.isVerified).toBe(false);
    expect(fresh?.avatarUrl).toMatch(/^http:\/\/test\/files\/avatar\//);
  });

  it("register on duplicate email throws ConflictError", async () => {
    const { register } = await import("./registration.service.js");
    await register({
      email: "dupe@b.com",
      name: "A",
      password: "Strong-Pass-1",
      avatar: PNG_AVATAR,
    });
    await expect(
      register({
        email: "dupe@b.com",
        name: "B",
        password: "Strong-Pass-2",
        avatar: PNG_AVATAR,
      }),
    ).rejects.toThrow(/already in use/i);
  });

  it("register without avatar throws ValidationError", async () => {
    const { register } = await import("./registration.service.js");
    await expect(
      register({
        email: "noavatar@b.com",
        name: "X",
        password: "Strong-Pass-1",
        // @ts-expect-error intentionally omitting required avatar
        avatar: undefined,
      }),
    ).rejects.toThrow(/profile picture/i);
  });

  it("getRegistrationStatus returns just status, not full user", async () => {
    const { register, getRegistrationStatus } = await import("./registration.service.js");
    await register({
      email: "candidate@b.com",
      name: "Candidate",
      password: "Strong-Pass-1",
      avatar: PNG_AVATAR,
    });
    const out = await getRegistrationStatus("candidate@b.com");
    expect(out).toEqual({ approvalStatus: "PENDING_HR" });
    expect(Object.keys(out)).toEqual(["approvalStatus"]);
  });
});
