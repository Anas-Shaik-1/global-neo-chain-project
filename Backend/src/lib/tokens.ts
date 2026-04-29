import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../config/index.js";

export interface AccessPayload {
  sub: string;
  role: string;
  isProjectManager: boolean;
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
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
  if (typeof decoded !== "object" || !decoded) throw new Error("invalid token");
  const { sub, role, isProjectManager } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof role !== "string") throw new Error("invalid payload");
  // Older tokens issued before the PM-as-flag refactor won't carry this claim.
  // Default to false so they continue to work until they expire.
  const pm = typeof isProjectManager === "boolean" ? isProjectManager : false;
  return { sub, role, isProjectManager: pm };
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);
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
