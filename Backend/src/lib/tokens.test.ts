import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "1h",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
});

describe("tokens", () => {
  it("signs and verifies an access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./tokens.js");
    const token = signAccessToken({ sub: "user-1", role: "ADMIN", isProjectManager: false });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("ADMIN");
    expect(payload.isProjectManager).toBe(false);
  });

  it("round-trips isProjectManager:true through sign/verify", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./tokens.js");
    const token = signAccessToken({ sub: "user-2", role: "EMPLOYEE", isProjectManager: true });
    const payload = verifyAccessToken(token);
    expect(payload.role).toBe("EMPLOYEE");
    expect(payload.isProjectManager).toBe(true);
  });

  it("throws on a tampered access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("./tokens.js");
    const token = signAccessToken({ sub: "user-1", role: "ADMIN", isProjectManager: false });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it("signs a refresh token with jti and family", async () => {
    const { signRefreshToken, verifyRefreshToken, newJti } = await import("./tokens.js");
    const jti = newJti();
    const family = newJti();
    const token = signRefreshToken({ sub: "user-1", jti, family });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.jti).toBe(jti);
    expect(payload.family).toBe(family);
  });

  it("newJti returns a unique string each call", async () => {
    const { newJti } = await import("./tokens.js");
    const a = newJti();
    const b = newJti();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});
