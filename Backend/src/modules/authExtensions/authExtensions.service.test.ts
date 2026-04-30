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
    approvalStatus: "ACTIVE",
  });
}

describe("authExtensions.service", () => {
  it("requestPasswordReset is silent for unknown emails (no token created)", async () => {
    const { requestPasswordReset } = await import("./authExtensions.service.js");
    const { PasswordResetToken } = await import("../../models/passwordResetToken.model.js");
    await requestPasswordReset("nobody@example.com");
    expect(await PasswordResetToken.countDocuments()).toBe(0);
  });

  it("requestPasswordReset persists a hashed token for known users", async () => {
    await seedUser("a@b.com", "pw");
    const { requestPasswordReset } = await import("./authExtensions.service.js");
    const { PasswordResetToken } = await import("../../models/passwordResetToken.model.js");
    await requestPasswordReset("a@b.com");
    const tokens = await PasswordResetToken.find({});
    expect(tokens).toHaveLength(1);
    // The persisted hash is sha256-hex of the raw token (64 chars).
    expect(tokens[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens[0]!.usedAt).toBeNull();
  });

  it("confirmPasswordReset with a valid token updates the password and clears the must-change flag", async () => {
    const u = await seedUser("a@b.com", "old-pw");
    const { User } = await import("../../models/user.model.js");
    await User.updateOne({ _id: u._id }, { $set: { mustChangePassword: true } });

    // Drive the flow end-to-end: create the token via the service, then capture
    // the raw token by intercepting the logged reset URL.
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
      const { requestPasswordReset, confirmPasswordReset } = await import(
        "./authExtensions.service.js"
      );
      await requestPasswordReset("a@b.com");
      const rawToken = new URL(capturedUrl!).searchParams.get("token")!;
      await confirmPasswordReset(rawToken, "new-pw-123");
    } finally {
      (logger as unknown as { info: typeof original }).info = original;
    }

    const fresh = await User.findById(u._id).select("+passwordHash");
    expect(fresh?.mustChangePassword).toBe(false);
    expect(
      await bcrypt.compare("new-pw-123", (fresh as unknown as { passwordHash: string }).passwordHash),
    ).toBe(true);
  });

  it("confirmPasswordReset throws when the token is expired", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { PasswordResetToken } = await import("../../models/passwordResetToken.model.js");
    const crypto = await import("node:crypto");
    const raw = "deadbeef".repeat(8);
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    await PasswordResetToken.create({
      userId: u._id,
      tokenHash,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const { confirmPasswordReset } = await import("./authExtensions.service.js");
    await expect(confirmPasswordReset(raw, "new-pw-123")).rejects.toThrow(/expired|Invalid/i);
  });

  it("confirmPasswordReset throws when the token has already been used", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { PasswordResetToken } = await import("../../models/passwordResetToken.model.js");
    const crypto = await import("node:crypto");
    const raw = "feedface".repeat(8);
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    await PasswordResetToken.create({
      userId: u._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    const { confirmPasswordReset } = await import("./authExtensions.service.js");
    await expect(confirmPasswordReset(raw, "new-pw-123")).rejects.toThrow(/already used|Invalid/i);
  });

  it("changePassword with the wrong current password throws", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { changePassword } = await import("./authExtensions.service.js");
    await expect(changePassword(u._id.toString(), "wrong", "new-pw-123")).rejects.toThrow(
      /incorrect|Unauthorized/i,
    );
  });

  it("changePassword with the right current password updates the hash and clears mustChangePassword", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { User } = await import("../../models/user.model.js");
    await User.updateOne({ _id: u._id }, { $set: { mustChangePassword: true } });
    const { changePassword } = await import("./authExtensions.service.js");
    await changePassword(u._id.toString(), "pw", "new-pw-123");
    const fresh = await User.findById(u._id).select("+passwordHash");
    expect(fresh?.mustChangePassword).toBe(false);
    expect(
      await bcrypt.compare("new-pw-123", (fresh as unknown as { passwordHash: string }).passwordHash),
    ).toBe(true);
  });

  it("setupTotp returns secret + otpauthUrl + qrCodeDataUrl and stores the secret without enabling 2FA", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { setupTotp } = await import("./authExtensions.service.js");
    const out = await setupTotp(u._id.toString());
    expect(out.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(out.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(out.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);

    const { User } = await import("../../models/user.model.js");
    const fresh = await User.findById(u._id).select("+totpSecret");
    expect(
      (fresh as unknown as { totpSecret: string | null }).totpSecret,
    ).toBe(out.secret);
    expect(fresh?.totpEnabled).toBe(false);
  });

  it("verifyTotp rejects an obviously-wrong 6-digit code", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { setupTotp, verifyTotp } = await import("./authExtensions.service.js");
    await setupTotp(u._id.toString());
    const ok = await verifyTotp(u._id.toString(), "000000");
    // The token "000000" has a chance to randomly match for a given secret, but
    // it's overwhelmingly likely to be wrong; if this ever flakes, broaden the
    // expectation to a proper-mismatch generator. For now, treat as the common case.
    expect(ok).toBe(false);
  });

  it("requestEmailVerification persists a hashed token and dispatches a mail message", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { setMailDriver } = await import("../../lib/mail.js");
    const captured: { to: string; subject: string; text: string }[] = [];
    setMailDriver({
      send: async (m) => {
        captured.push({ to: m.to, subject: m.subject, text: m.text });
      },
    });
    try {
      const { requestEmailVerification } = await import("./authExtensions.service.js");
      await requestEmailVerification(u._id.toString());
      const { EmailVerificationToken } = await import(
        "../../models/emailVerificationToken.model.js"
      );
      const tokens = await EmailVerificationToken.find({});
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tokens[0]!.usedAt).toBeNull();
      expect(captured).toHaveLength(1);
      expect(captured[0]!.to).toBe(u.email);
      expect(captured[0]!.text).toContain("/verify-email?token=");
    } finally {
      // Reset to default driver between tests.
      const { setMailDriver: reset } = await import("../../lib/mail.js");
      reset({ send: async () => {} });
    }
  });

  it("requestEmailVerification on an already-verified user throws ConflictError", async () => {
    const u = await seedUser("a@b.com", "pw");
    const { User } = await import("../../models/user.model.js");
    await User.updateOne({ _id: u._id }, { $set: { isVerified: true } });
    const { requestEmailVerification } = await import("./authExtensions.service.js");
    await expect(requestEmailVerification(u._id.toString())).rejects.toThrow(
      /already verified|Conflict/i,
    );
  });

  it("confirmEmailVerification with a valid token marks the user verified", async () => {
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
      const { requestEmailVerification, confirmEmailVerification } = await import(
        "./authExtensions.service.js"
      );
      await requestEmailVerification(u._id.toString());
      const rawToken = new URL(`http://x.test${capturedUrl!}`).searchParams.get("token")!;
      const out = await confirmEmailVerification(rawToken);
      expect(out.email).toBe(u.email);

      const { User } = await import("../../models/user.model.js");
      const fresh = await User.findById(u._id);
      expect(fresh?.isVerified).toBe(true);
    } finally {
      const { setMailDriver: reset } = await import("../../lib/mail.js");
      reset({ send: async () => {} });
    }
  });
});
