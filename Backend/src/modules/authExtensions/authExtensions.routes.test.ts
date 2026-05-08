import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
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
    approvalStatus: "ACTIVE",
  });
}

async function buildApp() {
  const { createApp } = await import("../../app.js");
  return createApp();
}

describe("/auth-extensions routes", () => {
  it("POST /auth/password-reset/request returns 204 even for unknown emails", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/password-reset/request")
      .send({ email: "nobody@example.com" });
    expect(res.status).toBe(204);
  });

  it("POST /auth/password-reset/request returns 204 for known emails (and creates a token)", async () => {
    await seedUser("a@b.com", "old-pw");
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/password-reset/request")
      .send({ email: "a@b.com" });
    expect(res.status).toBe(204);
    const { PasswordResetToken } = await import("../../models/passwordResetToken.model.js");
    expect(await PasswordResetToken.countDocuments()).toBe(1);
  });

  it("end-to-end: request → confirm → user can log in with the new password", async () => {
    await seedUser("a@b.com", "old-pw");

    // Capture the raw reset token by intercepting the logger.
    const { logger } = await import("../../lib/logger.js");
    const original = logger.info.bind(logger);
    let capturedUrl: string | undefined;
    (logger as unknown as { info: (...args: unknown[]) => void }).info = (
      ...args: unknown[]
    ) => {
      const obj = args[0];
      if (obj && typeof obj === "object" && "resetUrl" in obj) {
        capturedUrl = (obj as { resetUrl: string }).resetUrl;
      }
      return original(...(args as Parameters<typeof original>));
    };

    try {
      const app = await buildApp();
      const reqRes = await request(app)
        .post("/auth/password-reset/request")
        .send({ email: "a@b.com" });
      expect(reqRes.status).toBe(204);

      const rawToken = new URL(capturedUrl!).searchParams.get("token")!;
      const confirmRes = await request(app)
        .post("/auth/password-reset/confirm")
        .send({ token: rawToken, newPassword: "BrandNewPw-123" });
      expect(confirmRes.status).toBe(204);

      // Old password no longer works
      const oldLogin = await request(app)
        .post("/auth/login")
        .send({ email: "a@b.com", password: "old-pw" });
      expect(oldLogin.status).toBe(401);

      // New password works
      const newLogin = await request(app)
        .post("/auth/login")
        .send({ email: "a@b.com", password: "BrandNewPw-123" });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.accessToken).toBeTruthy();
    } finally {
      (logger as unknown as { info: typeof original }).info = original;
    }
  });

  it("POST /auth/password/change requires bearer auth", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/auth/password/change")
      .send({ currentPassword: "x", newPassword: "y" });
    expect(res.status).toBe(401);
  });

  it("POST /auth/2fa/setup returns secret + qr data url for an authenticated user", async () => {
    await seedUser("a@b.com", "pw");
    const app = await buildApp();
    const login = await request(app).post("/auth/login").send({ email: "a@b.com", password: "pw" });
    const res = await request(app)
      .post("/auth/2fa/setup")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(typeof res.body.qrCodeDataUrl).toBe("string");
    expect(res.body.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("POST /auth/login returns { requires2FA: true } when the user has TOTP enabled", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { User } = await import("../../models/user.model.js");
    await User.updateOne(
      { _id: u._id },
      { $set: { totpEnabled: true, totpSecret: "JBSWY3DPEHPK3PXP" } },
    );
    const app = await buildApp();
    const res = await request(app).post("/auth/login").send({ email: "a@b.com", password: "pw" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requires2FA: true });
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("POST /auth/verify-email/request requires bearer auth", async () => {
    const app = await buildApp();
    const res = await request(app).post("/auth/verify-email/request").send();
    expect(res.status).toBe(401);
  });

  it("POST /auth/verify-email/request returns 204 when authed and unverified", async () => {
    await seedUser("a@b.com", "pw");
    const { setMailDriver } = await import("../../lib/mail.js");
    setMailDriver({ send: async () => {} });
    try {
      const app = await buildApp();
      const login = await request(app)
        .post("/auth/login")
        .send({ email: "a@b.com", password: "pw" });
      const res = await request(app)
        .post("/auth/verify-email/request")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send();
      expect(res.status).toBe(204);
      const { EmailVerificationToken } = await import(
        "../../models/emailVerificationToken.model.js"
      );
      expect(await EmailVerificationToken.countDocuments()).toBe(1);
    } finally {
      const { setMailDriver: reset } = await import("../../lib/mail.js");
      reset({ send: async () => {} });
    }
  });

  it("POST /auth/phone/verify with bad code returns 401", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { User } = await import("../../models/user.model.js");
    await User.updateOne({ _id: u._id }, { $set: { phone: "+15555550100" } });
    const { setSmsDriver } = await import("../../lib/sms.js");
    setSmsDriver({ send: async () => {} });
    try {
      const app = await buildApp();
      const login = await request(app).post("/auth/login").send({ email: "a@b.com", password: "pw" });
      // Need to request first to seed a code on the user.
      await request(app)
        .post("/auth/phone/request-verify")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send();
      const res = await request(app)
        .post("/auth/phone/verify")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send({ code: "000000" });
      expect(res.status).toBe(401);
    } finally {
      const { setSmsDriver: reset } = await import("../../lib/sms.js");
      reset({ send: async () => {} });
    }
  });

  it("POST /auth/phone/request-verify → /auth/phone/verify happy path", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { User } = await import("../../models/user.model.js");
    await User.updateOne({ _id: u._id }, { $set: { phone: "+15555550100" } });

    const { setSmsDriver } = await import("../../lib/sms.js");
    let capturedOtp: string | undefined;
    setSmsDriver({
      send: async (m) => {
        capturedOtp = m.body.match(/\b(\d{6})\b/)?.[1];
      },
    });
    try {
      const app = await buildApp();
      const login = await request(app)
        .post("/auth/login")
        .send({ email: "a@b.com", password: "pw" });

      const reqRes = await request(app)
        .post("/auth/phone/request-verify")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send();
      expect(reqRes.status).toBe(204);
      expect(capturedOtp).toMatch(/^\d{6}$/);

      const verRes = await request(app)
        .post("/auth/phone/verify")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send({ code: capturedOtp });
      expect(verRes.status).toBe(204);

      const fresh = await User.findById(u._id);
      expect(fresh?.isPhoneVerified).toBe(true);
    } finally {
      const { setSmsDriver: reset } = await import("../../lib/sms.js");
      reset({ send: async () => {} });
    }
  });

  it("POST /auth/verify-email/confirm with a valid token returns 200 and flips isVerified", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { setMailDriver } = await import("../../lib/mail.js");
    let capturedUrl: string | undefined;
    setMailDriver({
      send: async (m) => {
        const match = m.text.match(/\/verify-email\?token=([0-9a-f]+)/);
        if (match) capturedUrl = match[0];
      },
    });
    try {
      const app = await buildApp();
      const login = await request(app)
        .post("/auth/login")
        .send({ email: "a@b.com", password: "pw" });
      const reqRes = await request(app)
        .post("/auth/verify-email/request")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .send();
      expect(reqRes.status).toBe(204);

      const rawToken = new URL(`http://x.test${capturedUrl!}`).searchParams.get("token")!;
      const confirmRes = await request(app)
        .post("/auth/verify-email/confirm")
        .send({ token: rawToken });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.email).toBe("a@b.com");

      const { User } = await import("../../models/user.model.js");
      const fresh = await User.findById(u._id);
      expect(fresh?.isVerified).toBe(true);
    } finally {
      const { setMailDriver: reset } = await import("../../lib/mail.js");
      reset({ send: async () => {} });
    }
  });
});
