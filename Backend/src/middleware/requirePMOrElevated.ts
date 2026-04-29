import type { RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

/**
 * Allows the request if the caller is an Admin/HR (project-creation rights are
 * already implicit in those roles), or an Employee with the isProjectManager
 * sub-role flag flipped on. Anything else is 403.
 */
export const requirePMOrElevated: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new UnauthorizedError());
  const { role, isProjectManager } = req.user;
  if (role === "ADMIN" || role === "HR") return next();
  if (role === "EMPLOYEE" && isProjectManager) return next();
  return next(new ForbiddenError("Project manager privileges required"));
};
