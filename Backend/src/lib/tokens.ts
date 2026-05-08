import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../config/index.js";

export interface AccessPayload {
  sub: string;
  role: string;
  isProjectManager: boolean;
  /** Unix-seconds expiry from the JWT `exp` claim. */
  exp?: number;
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  family: string;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  // Pin the accepted algorithm to HS256 (matches the sign-side default).
  // Without this, a token forged with `alg: "none"` or RS256-with-public-key
  // tricks could be accepted on some jsonwebtoken versions.
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || !decoded) throw new Error("invalid token");
  const { sub, role, isProjectManager, exp } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof role !== "string") throw new Error("invalid payload");
  // Older tokens issued before the PM-as-flag refactor won't carry this claim.
  // Default to false so they continue to work until they expire.
  const pm = typeof isProjectManager === "boolean" ? isProjectManager : false;
  return {
    sub,
    role,
    isProjectManager: pm,
    exp: typeof exp === "number" ? exp : undefined,
  };
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshPayload {
  // Pin the accepted algorithm to HS256 (matches the sign-side default).
  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || !decoded) throw new Error("invalid token");
  const { sub, jti, family } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof jti !== "string" || typeof family !== "string") {
    throw new Error("invalid payload");
  }
  return { sub, jti, family };
}

export function newJti(): string {
  return uuid();
}
