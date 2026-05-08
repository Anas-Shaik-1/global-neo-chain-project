import bcrypt from "bcrypt";
import { Types, type HydratedDocument } from "mongoose";
import { User, type Role, type UserDoc, type ApprovalStatus } from "../../models/user.model.js";
import { RefreshToken } from "../../models/refreshToken.model.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newJti,
} from "../../lib/tokens.js";
import { UnauthorizedError } from "../../lib/errors.js";

const APPROVAL_BLOCK_MESSAGES: Record<Exclude<ApprovalStatus, "ACTIVE">, string> = {
  PENDING_HR: "Your account is awaiting HR approval",
  PENDING_ADMIN: "Your account is awaiting Admin approval",
  REJECTED: "Your account application was not approved",
};

// Mirror of JWT_REFRESH_TTL ("7d") expressed in ms for the DB expiresAt index.
// Exported so the cookie max-age in auth.controller.ts can reference the same
// constant — keeping the JWT exp and the HTTP-only cookie lifetime in lockstep.
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Pre-computed bcrypt hash used for constant-time login on the no-user branch.
// We compare the submitted password against this dummy hash so the response
// time when the email is unknown is indistinguishable from the response time
// when the email exists but the password is wrong — closing a user-enumeration
// side channel.
const DUMMY_HASH = bcrypt.hashSync("invalid-password-placeholder", 12);

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isProjectManager: boolean;
  isVerified: boolean;
  isPhoneVerified: boolean;
  mustChangePassword: boolean;
  totpEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

type FullUser = HydratedDocument<UserDoc> & {
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicUser(user: FullUser): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isProjectManager: Boolean(user.isProjectManager),
    isVerified: user.isVerified,
    isPhoneVerified: Boolean(user.isPhoneVerified),
    mustChangePassword: Boolean(user.mustChangePassword),
    totpEnabled: Boolean(user.totpEnabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Verifies email + password and returns the user document. Does NOT issue tokens
 * and does NOT enforce 2FA — the controller decides whether to issue tokens
 * directly (no 2FA) or branch to the requires-2FA flow.
 *
 * After a successful credential check, this also enforces the 2-stage approval
 * pipeline: only `approvalStatus === "ACTIVE"` users may complete login. The
 * thrown message is surfaced verbatim by the FE login form, so the user knows
 * exactly which queue they're sitting in.
 */
export async function loginCheckCredentials(email: string, password: string): Promise<FullUser> {
  const user = (await User.findOne({ email: email.toLowerCase() }).select("+passwordHash")) as FullUser | null;
  if (!user) {
    // Burn ~one bcrypt-compare worth of CPU so the no-user path takes the
    // same wall-clock time as the wrong-password path. Result is discarded.
    await bcrypt.compare(password, DUMMY_HASH);
    throw new UnauthorizedError("Invalid credentials");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  if (user.approvalStatus !== "ACTIVE") {
    const message =
      APPROVAL_BLOCK_MESSAGES[user.approvalStatus as Exclude<ApprovalStatus, "ACTIVE">] ??
      "Account is not active";
    throw new UnauthorizedError(message);
  }

  return user;
}

/** Issues an access + refresh token pair for an already-validated user. */
export async function issueTokensFor(user: FullUser): Promise<AuthPayload> {
  const family = newJti();
  return issueTokens(user._id, user.role, Boolean(user.isProjectManager), family, toPublicUser(user));
}

/**
 * Legacy entrypoint kept for backwards compatibility (and currently unused after
 * the controller refactor). Performs credential check + token issue in one call.
 * Note: this does NOT enforce 2FA — callers that care about 2FA should use
 * loginCheckCredentials + issueTokensFor and check user.totpEnabled themselves.
 */
export async function login(email: string, password: string): Promise<AuthPayload> {
  const user = await loginCheckCredentials(email, password);
  return issueTokensFor(user);
}

export async function rotate(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError("Invalid refresh");
  }

  const newRefreshJti = newJti();

  // Atomic claim: only the first concurrent caller flips revokedAt from null → set.
  const claimed = await RefreshToken.findOneAndUpdate(
    { jti: payload.jti, revokedAt: null },
    { $set: { revokedAt: new Date(), replacedBy: newRefreshJti } },
    { new: false },
  );

  if (!claimed) {
    // No matching un-revoked token. Either the jti was never issued (forged/expired family),
    // or it was already revoked (reuse). Discriminate to drive the right policy.
    const reused = await RefreshToken.findOne({ jti: payload.jti });
    if (reused) {
      // Reuse detected: revoke the entire family.
      await RefreshToken.updateMany(
        { family: reused.family, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      throw new UnauthorizedError("Refresh reuse detected");
    }
    throw new UnauthorizedError("Unknown refresh");
  }

  const user = await User.findById(claimed.userId);
  if (!user) throw new UnauthorizedError("User not found");

  // Refresh-time gate: if the user has since been deactivated or fell out of
  // ACTIVE approval (e.g. suspended pending review), revoke the entire family
  // so a stale refresh cookie can't keep minting access tokens.
  if (user.isActive === false || user.approvalStatus !== "ACTIVE") {
    await RefreshToken.updateMany(
      { family: claimed.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new UnauthorizedError("Account is not active");
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    isProjectManager: Boolean(user.isProjectManager),
  });
  const refreshToken = signRefreshToken({ sub: user._id.toString(), jti: newRefreshJti, family: claimed.family });

  await RefreshToken.create({
    jti: newRefreshJti,
    family: claimed.family,
    userId: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });

  return { accessToken, refreshToken };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    await RefreshToken.updateMany(
      { family: payload.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  } catch {
    // ignore; logout is best-effort
  }
}

export async function getMe(userId: string) {
  const user = (await User.findById(userId)) as FullUser | null;
  if (!user) throw new UnauthorizedError("User not found");
  return toPublicUser(user);
}

async function issueTokens(
  userId: Types.ObjectId,
  role: Role,
  isProjectManager: boolean,
  family: string,
  publicUser: PublicUser,
): Promise<AuthPayload> {
  const jti = newJti();
  const accessToken = signAccessToken({ sub: userId.toString(), role, isProjectManager });
  const refreshToken = signRefreshToken({ sub: userId.toString(), jti, family });
  await RefreshToken.create({
    jti,
    family,
    userId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken, user: publicUser };
}
