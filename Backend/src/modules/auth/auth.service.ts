import bcrypt from "bcrypt";
import { Types } from "mongoose";
import { User, type Role } from "../../models/user.model.js";
import { RefreshToken } from "../../models/refreshToken.model.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newJti,
} from "../../lib/tokens.js";
import { UnauthorizedError } from "../../lib/errors.js";

// Mirror of JWT_REFRESH_TTL ("7d") expressed in ms for the DB expiresAt index.
// If you change JWT_REFRESH_TTL in env, update this too.
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) throw new UnauthorizedError("Invalid credentials");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  const family = newJti();
  return issueTokens(user._id, user.role, family, {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: (user as unknown as { createdAt: Date }).createdAt,
    updatedAt: (user as unknown as { updatedAt: Date }).updatedAt,
  });
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

  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
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
  const user = await User.findById(userId);
  if (!user) throw new UnauthorizedError("User not found");
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: (user as unknown as { createdAt: Date }).createdAt,
    updatedAt: (user as unknown as { updatedAt: Date }).updatedAt,
  };
}

async function issueTokens(
  userId: Types.ObjectId,
  role: Role,
  family: string,
  publicUser: AuthPayload["user"],
): Promise<AuthPayload> {
  const jti = newJti();
  const accessToken = signAccessToken({ sub: userId.toString(), role });
  const refreshToken = signRefreshToken({ sub: userId.toString(), jti, family });
  await RefreshToken.create({
    jti,
    family,
    userId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { accessToken, refreshToken, user: publicUser };
}
