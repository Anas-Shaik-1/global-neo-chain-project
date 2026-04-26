import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
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

async function seedUser(email: string, password: string) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash(password, 4),
    name: "Test",
    role: "ADMIN",
  });
}

describe("auth.service", () => {
  it("login returns access + refresh + user on valid credentials", async () => {
    await seedUser("a@b.com", "pw");
    const { login } = await import("./auth.service.js");
    const out = await login("A@B.COM", "pw");
    expect(out.accessToken).toBeTruthy();
    expect(out.refreshToken).toBeTruthy();
    expect(out.user.email).toBe("a@b.com");
  });

  it("login rejects wrong password", async () => {
    await seedUser("a@b.com", "pw");
    const { login } = await import("./auth.service.js");
    await expect(login("a@b.com", "wrong")).rejects.toThrow();
  });

  it("login rejects unknown email", async () => {
    const { login } = await import("./auth.service.js");
    await expect(login("nope@b.com", "pw")).rejects.toThrow();
  });

  it("rotate issues new tokens and revokes old refresh", async () => {
    await seedUser("a@b.com", "pw");
    const { login, rotate } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");
    const second = await rotate(first.refreshToken);
    expect(second.accessToken).toBeTruthy();
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const stored = await RefreshToken.find({});
    const revoked = stored.filter((t) => t.revokedAt !== null);
    expect(revoked.length).toBe(1);
  });

  it("rotate detects refresh reuse and revokes the family", async () => {
    await seedUser("a@b.com", "pw");
    const { login, rotate } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");
    await rotate(first.refreshToken);
    await expect(rotate(first.refreshToken)).rejects.toThrow(/reuse/i);
    const remaining = await RefreshToken.find({ revokedAt: null });
    expect(remaining.length).toBe(0);
  });

  it("logout revokes the family", async () => {
    await seedUser("a@b.com", "pw");
    const { login, logout } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");
    await logout(first.refreshToken);
    const remaining = await RefreshToken.find({ revokedAt: null });
    expect(remaining.length).toBe(0);
  });

  it("getMe returns current user shape", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { getMe } = await import("./auth.service.js");
    const me = await getMe(u._id.toString());
    expect(me.email).toBe("a@b.com");
    expect(me.role).toBe("ADMIN");
  });

  it("rotate handles concurrent calls with the same refresh: one succeeds, the other is detected as reuse", async () => {
    await seedUser("a@b.com", "pw");
    const { login, rotate } = await import("./auth.service.js");
    const { RefreshToken } = await import("../../models/refreshToken.model.js");
    const first = await login("a@b.com", "pw");

    // Two concurrent rotations with the same refresh token
    const results = await Promise.allSettled([
      rotate(first.refreshToken),
      rotate(first.refreshToken),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // After concurrent rotation, the one that lost should have triggered family revoke.
    // The winning rotation produced one new active token; the losing one revoked it as reuse.
    const remaining = await RefreshToken.find({ revokedAt: null });
    expect(remaining.length).toBe(0);
  });
});
