import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { config } from "../config/index.js";

export interface AccessPayload {
  sub: string;
  role: string;
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
  const { sub, role } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof role !== "string") throw new Error("invalid payload");
  return { sub, role };
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
