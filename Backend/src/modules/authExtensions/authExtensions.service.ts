import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { generateSecret, generateURI, verify as otpVerify } from "otplib";
import qrcode from "qrcode";
import { User } from "../../models/user.model.js";
import { PasswordResetToken } from "../../models/passwordResetToken.model.js";
import { EmailVerificationToken } from "../../models/emailVerificationToken.model.js";
import { config } from "../../config/index.js";
import { logger } from "../../lib/logger.js";
import { getMailDriver } from "../../lib/mail.js";
import { getSmsDriver } from "../../lib/sms.js";
import {
  loginCheckCredentials,
  issueTokensFor,
  type AuthPayload,
} from "../auth/auth.service.js";
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../lib/errors.js";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PHONE_OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PHONE_OTP_MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;
const ISSUER = "Global NeoChain";
// otplib's `epochTolerance` is in SECONDS, not steps — allow ±30s of clock
// drift either side to be friendly to slightly-skewed authenticator clocks.
const TOTP_TOLERANCE: [number, number] = [30, 30];

// In-memory replay-protection map: userId → last accepted TOTP timeStep.
// Reject any submitted code whose timeStep <= the stored value, so the same
// 30-second window can't be reused. TODO: persist on the user document
// (`totpLastUsedStep`) once the model migration lands; for now an in-memory
// map is acceptable for a single-process deployment and degrades gracefully
// (a process restart simply re-arms the window).
const totpLastUsedStepByUserId = new Map<string, number>();

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

interface TotpVerifyOutcome {
  valid: boolean;
  timeStep?: number;
}

async function totpIsValid(
  token: string,
  secret: string,
  afterTimeStep?: number,
): Promise<TotpVerifyOutcome> {
  try {
    const result = await otpVerify({
      token,
      secret,
      epochTolerance: TOTP_TOLERANCE,
      afterTimeStep,
    });
    if (result.valid) {
      // The umbrella otplib `verify` returns a TOTP|HOTP discriminated union;
      // only the TOTP variant carries `timeStep`. Narrow with `in` so TS is
      // happy and we degrade gracefully if HOTP somehow comes back.
      const ts = "timeStep" in result ? result.timeStep : undefined;
      return { valid: true, timeStep: ts };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Request a password reset email. Always returns silently (we never reveal
 * whether the email is known) to avoid account-enumeration leaks.
 *
 * Email delivery is dispatched through the pluggable {@link MailDriver}
 * interface — by default the {@link ConsoleMailDriver} prints the message to
 * the structured logger so devs can grab the reset link locally. To enable
 * real delivery, implement {@link MailDriver} for your provider (SES,
 * Postmark, Resend, SendGrid, …) and call {@link setMailDriver} at boot.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    logger.info({ email }, "password-reset requested for unknown email; ignoring");
    return;
  }

  // Generate a fresh raw token; persist only its sha256 hash.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${config.FRONTEND_ORIGIN}/reset-password?token=${rawToken}`;
  const subject = "Reset your Global NeoChain password";
  const text =
    `Hi ${user.name},\n\n` +
    `We received a request to reset the password for your Global NeoChain account.\n` +
    `Open the link below to choose a new password:\n\n` +
    `${resetUrl}\n\n` +
    `This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;
  const html =
    `<p>Hi ${user.name},</p>` +
    `<p>We received a request to reset the password for your Global NeoChain account. ` +
    `Click the link below to choose a new password:</p>` +
    `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
    `<p>This link <strong>expires in 1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>`;

  await getMailDriver().send({ to: user.email, subject, text, html });

  // Keep a structured trace for ops & test interception (the existing tests
  // rely on capturing `resetUrl` from this log line). The raw URL contains
  // the single-use reset token, so we omit it in production to keep the
  // token out of log-aggregation pipelines and disk-resident log files.
  const includeUrl = config.NODE_ENV !== "production";
  logger.info(
    {
      userId: user._id.toString(),
      email: user.email,
      ...(includeUrl ? { resetUrl } : {}),
      expiresAt,
    },
    "password reset link dispatched via MailDriver",
  );
}

/**
 * Confirm a password reset by exchanging a raw token for a new password.
 * Throws UnauthorizedError on missing / expired / already-used tokens.
 */
export async function confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = sha256(rawToken);
  const record = await PasswordResetToken.findOne({ tokenHash });
  if (!record) throw new UnauthorizedError("Invalid or expired reset token");
  if (record.usedAt) throw new UnauthorizedError("Reset token already used");
  if (record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("Reset token expired");
  }

  const user = await User.findById(record.userId);
  if (!user) throw new UnauthorizedError("Invalid or expired reset token");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.passwordHash = passwordHash;
  user.mustChangePassword = false;
  await user.save();

  record.usedAt = new Date();
  await record.save();
}

/**
 * Authenticated password change. Verifies the current password before updating.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new UnauthorizedError("User not found");

  const ok = await bcrypt.compare(currentPassword, (user as unknown as { passwordHash: string }).passwordHash);
  if (!ok) throw new UnauthorizedError("Current password is incorrect");

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  user.mustChangePassword = false;
  await user.save();

  void notifySecurityEvent(userId, {
    kind: "PASSWORD_CHANGED",
    title: "Your password was changed",
    body: "If this wasn't you, reset it immediately and contact support.",
    link: "/security",
  });
}

async function notifySecurityEvent(
  userId: string,
  input: {
    kind: "PASSWORD_CHANGED" | "TWO_FA_ENABLED" | "TWO_FA_DISABLED";
    title: string;
    body?: string;
    link?: string;
  },
): Promise<void> {
  try {
    const { notify } = await import("../notifications/notifications.service.js");
    await notify(userId, input);
  } catch {
    // Best-effort: never block the security flow on notification failure.
  }
}

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

/**
 * Generate a TOTP secret + QR code for the user. The secret is stored on the
 * user immediately, but `totpEnabled` stays false until the user completes
 * verification via verifyTotp.
 */
export async function setupTotp(userId: string): Promise<TotpSetupResult> {
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("User not found");

  // Refuse to overwrite an already-active 2FA secret. If we silently rotated
  // it, an attacker with a session could re-enroll their own authenticator
  // app and lock the legitimate user out. Force the explicit disable + setup
  // flow (which requires the password) instead.
  if (user.totpEnabled === true) {
    throw new ConflictError("Disable 2FA before re-enrolling.");
  }

  const secret = generateSecret();
  user.totpSecret = secret;
  user.totpEnabled = false;
  await user.save();

  const otpauthUrl = generateURI({
    strategy: "totp",
    issuer: ISSUER,
    label: user.email,
    secret,
  });
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrCodeDataUrl };
}

/**
 * Verify a 6-digit TOTP code against the user's stored secret. On success,
 * flip totpEnabled to true. Returns whether the code was valid.
 */
export async function verifyTotp(userId: string, token: string): Promise<boolean> {
  const user = await User.findById(userId).select("+totpSecret");
  if (!user) throw new UnauthorizedError("User not found");

  const secret = (user as unknown as { totpSecret: string | null }).totpSecret;
  if (!secret) {
    throw new ValidationError("2FA setup has not been started");
  }

  const lastStep = totpLastUsedStepByUserId.get(userId);
  const outcome = await totpIsValid(token, secret, lastStep);
  if (!outcome.valid) return false;
  // Replay protection: stamp the accepted timeStep so the same code (and any
  // earlier window) cannot be replayed within the tolerance band.
  if (outcome.timeStep !== undefined) {
    totpLastUsedStepByUserId.set(userId, outcome.timeStep);
  }

  const wasEnabled = user.totpEnabled === true;
  user.totpEnabled = true;
  await user.save();
  if (!wasEnabled) {
    void notifySecurityEvent(userId, {
      kind: "TWO_FA_ENABLED",
      title: "Two-factor authentication enabled",
      body: "Codes from your authenticator app will be required at sign-in.",
      link: "/security",
    });
  }
  return true;
}

/**
 * Disable TOTP. Requires the user's password to defend against an attacker
 * who has only an active session.
 */
export async function disableTotp(userId: string, password: string): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new UnauthorizedError("User not found");

  const ok = await bcrypt.compare(password, (user as unknown as { passwordHash: string }).passwordHash);
  if (!ok) throw new UnauthorizedError("Password is incorrect");

  const wasEnabled = user.totpEnabled === true;
  user.totpSecret = null;
  user.totpEnabled = false;
  await user.save();
  if (wasEnabled) {
    void notifySecurityEvent(userId, {
      kind: "TWO_FA_DISABLED",
      title: "Two-factor authentication disabled",
      body: "If this wasn't you, change your password and re-enable 2FA.",
      link: "/security",
    });
  }
}

/**
 * Login completion when the user has 2FA enabled. Verifies email + password
 * (via the existing auth service) THEN verifies the supplied TOTP code, only
 * issuing tokens if all three check out.
 */
export async function loginWith2FA(
  email: string,
  password: string,
  token: string,
): Promise<AuthPayload> {
  // Reuses the existing credential check (constant-time bcrypt etc.)
  const user = await loginCheckCredentials(email, password);

  if (!user.totpEnabled) {
    // Keep this path strict: callers who hit /auth/login-2fa for a non-2FA
    // account should fall back to /auth/login. Treat as auth failure to avoid
    // signal-leakage.
    throw new UnauthorizedError("Invalid credentials");
  }

  // Reload with the secret (the credential check selected +passwordHash but
  // not +totpSecret).
  const fullUser = await User.findById(user._id).select("+totpSecret");
  const secret = (fullUser as unknown as { totpSecret: string | null } | null)?.totpSecret ?? null;
  if (!secret) throw new UnauthorizedError("Invalid credentials");

  const userIdStr = user._id.toString();
  const lastStep = totpLastUsedStepByUserId.get(userIdStr);
  const outcome = await totpIsValid(token, secret, lastStep);
  if (!outcome.valid) throw new UnauthorizedError("Invalid TOTP code");
  // Replay protection: same as verifyTotp, prevent reuse of a submitted code
  // within the tolerance window across both 2FA-setup and 2FA-login paths.
  if (outcome.timeStep !== undefined) {
    totpLastUsedStepByUserId.set(userIdStr, outcome.timeStep);
  }

  return issueTokensFor(user);
}

/**
 * Begin the email-verification flow. Generates a random raw token, persists
 * only its sha256 hash, and dispatches a verification link via the
 * {@link MailDriver}. The link is valid for 24 hours.
 *
 * Throws {@link ConflictError} if the user is already verified — callers
 * (e.g. the HR auto-send hook) can catch + ignore that case.
 */
export async function requestEmailVerification(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User");
  if (user.isVerified) throw new ConflictError("Email already verified");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  const verifyUrl = `${config.FRONTEND_ORIGIN}/verify-email?token=${rawToken}`;
  const subject = "Verify your Global NeoChain email";
  const text =
    `Welcome to Global NeoChain.\n\n` +
    `Click this link within 24 hours to verify your email:\n${verifyUrl}\n\n` +
    `If you didn't request this, ignore this message.`;
  const html =
    `<p>Welcome to Global NeoChain.</p>` +
    `<p><a href="${verifyUrl}">Click here to verify your email</a></p>` +
    `<p>The link expires in <strong>24 hours</strong>.</p>`;

  await getMailDriver().send({ to: user.email, subject, text, html });

  // Structured trace for ops + test interception (mirrors the password-reset path).
  logger.info(
    { userId: user._id.toString(), email: user.email, verifyUrl, expiresAt },
    "email verification link dispatched via MailDriver",
  );
}

/**
 * Confirm an email verification by exchanging a raw token for a verified
 * status flip. Returns the user's id + email so callers can confirm what was
 * verified.
 */
export async function confirmEmailVerification(
  rawToken: string,
): Promise<{ userId: string; email: string }> {
  const tokenHash = sha256(rawToken);
  const record = await EmailVerificationToken.findOne({ tokenHash });
  if (!record) throw new UnauthorizedError("Invalid verification token");
  if (record.usedAt) throw new UnauthorizedError("Verification token already used");
  if (record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("Verification token expired");
  }

  const user = await User.findById(record.userId);
  if (!user) throw new UnauthorizedError("User no longer exists");

  user.isVerified = true;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  return { userId: user._id.toString(), email: user.email };
}

// ---------------------------------------------------------------------------
// Phone-number verification via 6-digit SMS OTP
// ---------------------------------------------------------------------------

/** 6 digits, leading-zero safe — `crypto.randomInt` is uniform over [0, 1e6). */
function generateNumericOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Begin phone-verification: generate a 6-digit OTP, persist only its sha256
 * hash with a 5-minute expiry, reset the attempts counter, and dispatch the
 * code via the {@link SmsDriver} interface.
 *
 * Throws {@link ValidationError} when the user has no phone number on file
 * (the FE should disable the action in that case but the server checks
 * defensively), and {@link ConflictError} when the phone is already verified.
 */
export async function requestPhoneVerification(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User");
  if (!user.phone) throw new ValidationError("Set a phone number on your profile first");
  if (user.isPhoneVerified) throw new ConflictError("Phone already verified");

  const otp = generateNumericOtp();
  const codeHash = sha256(otp);

  user.phoneVerificationCodeHash = codeHash;
  user.phoneVerificationExpiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS);
  user.phoneVerificationAttempts = 0;
  await user.save();

  await getSmsDriver().send({
    to: user.phone,
    body: `Your Global NeoChain verification code is ${otp}. It expires in 5 minutes.`,
  });

  // Structured trace for ops; the OTP itself is never logged.
  logger.info(
    { userId: user._id.toString(), phone: user.phone, expiresAt: user.phoneVerificationExpiresAt },
    "phone verification OTP dispatched via SmsDriver",
  );
}

/**
 * Confirm phone verification by exchanging a 6-digit OTP for a verified-phone
 * flag flip. Wrong submissions increment the attempts counter and after
 * {@link PHONE_OTP_MAX_ATTEMPTS} we lock out the active code so the caller has
 * to request a fresh one — defends against brute-forcing the 1-in-a-million
 * code space.
 */
export async function confirmPhoneVerification(userId: string, code: string): Promise<void> {
  const user = await User.findById(userId).select(
    "+phoneVerificationCodeHash +phoneVerificationExpiresAt +phoneVerificationAttempts",
  );
  if (!user) throw new NotFoundError("User");
  if (user.isPhoneVerified) throw new ConflictError("Phone already verified");
  if (!user.phoneVerificationCodeHash || !user.phoneVerificationExpiresAt) {
    throw new ValidationError("Request a verification code first");
  }
  if (user.phoneVerificationExpiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("Code expired — request a new one");
  }
  if ((user.phoneVerificationAttempts ?? 0) >= PHONE_OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedError("Too many attempts — request a new code");
  }

  const submittedHash = sha256(code);
  if (submittedHash !== user.phoneVerificationCodeHash) {
    user.phoneVerificationAttempts = (user.phoneVerificationAttempts ?? 0) + 1;
    await user.save();
    throw new UnauthorizedError("Incorrect code");
  }

  user.isPhoneVerified = true;
  user.phoneVerificationCodeHash = null;
  user.phoneVerificationExpiresAt = null;
  user.phoneVerificationAttempts = 0;
  await user.save();
}
