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
const BCRYPT_ROUNDS = 12;
const ISSUER = "Global NeoChain";
// Allow 1 step (~30s) of drift either side to be friendly to slightly-skewed clocks.
const TOTP_TOLERANCE: [number, number] = [1, 1];

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function totpIsValid(token: string, secret: string): Promise<boolean> {
  try {
    const result = await otpVerify({ token, secret, epochTolerance: TOTP_TOLERANCE });
    return result.valid;
  } catch {
    return false;
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
  // rely on capturing `resetUrl` from this log line).
  logger.info(
    { userId: user._id.toString(), email: user.email, resetUrl, expiresAt },
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

  const valid = await totpIsValid(token, secret);
  if (!valid) return false;

  user.totpEnabled = true;
  await user.save();
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

  user.totpSecret = null;
  user.totpEnabled = false;
  await user.save();
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

  const valid = await totpIsValid(token, secret);
  if (!valid) throw new UnauthorizedError("Invalid TOTP code");

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
