import type { RequestHandler } from "express";
import { verifyAccessToken } from "../lib/tokens.js";
import { UnauthorizedError } from "../lib/errors.js";
import { ROLES, type Role } from "../models/user.model.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing bearer token"));
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    if (!(ROLES as readonly string[]).includes(payload.role)) {
      return next(new UnauthorizedError("Invalid or expired token"));
    }
    req.user = { id: payload.sub, role: payload.role as Role };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
};
