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

export async function getCharts(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const granularity = (req.query.granularity as svc.Granularity | undefined) ?? "month";
    if (granularity !== "day" && granularity !== "month" && granularity !== "year") {
      res.status(400).json({ code: "VALIDATION", message: "granularity must be day | month | year" });
      return;
    }
    // Admin/HR may inspect another user's chart via ?userId=. For everyone else
    // (or when userId is omitted), the employee dashboard scopes to themselves;
    // admin/HR with no userId param sees the company-wide aggregate.
    const elevated = me.role === "ADMIN" || me.role === "HR";
    const requestedUserId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    let userId: string | undefined;
    if (elevated) {
      userId = requestedUserId; // may be undefined → aggregate
    } else {
      userId = me.id;
    }
    const out = await svc.chartSeries({ granularity, userId });
    res.json(out);
  } catch (err) {
    next(err);
  }
}
