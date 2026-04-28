import type { Request, Response, NextFunction } from "express";
import * as svc from "./dashboard.service.js";
import { UnauthorizedError } from "../../lib/errors.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function getAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const out = await svc.adminStats();
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function getHr(_req: Request, res: Response, next: NextFunction) {
  try {
    const out = await svc.hrStats();
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const out = await svc.employeeStats(me.id);
    res.json(out);
  } catch (err) {
    next(err);
  }
}
