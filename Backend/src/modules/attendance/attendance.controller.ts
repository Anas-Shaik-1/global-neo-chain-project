import type { Request, Response, NextFunction } from "express";
import * as svc from "./attendance.service.js";
import { UnauthorizedError } from "../../lib/errors.js";

export async function postClockIn(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const body =
      (req.validated as { notes?: string; isRemote?: boolean } | undefined) ?? {};
    const entry = await svc.clockIn(req.user.id, {
      notes: body.notes,
      isRemote: body.isRemote,
    });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function postClockOut(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const body = (req.validated as { notes?: string } | undefined) ?? {};
    const entry = await svc.clockOut(req.user.id, body.notes);
    res.json(entry);
  } catch (err) {
    next(err);
  }
}

export async function postLunchStart(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const entry = await svc.startLunch(req.user.id);
    res.json(entry);
  } catch (err) {
    next(err);
  }
}

export async function postLunchEnd(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const entry = await svc.endLunch(req.user.id);
    res.json(entry);
  } catch (err) {
    next(err);
  }
}

export async function getMyMonth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const result = await svc.myMonth(req.user.id, month);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeMonth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId as string;
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const result = await svc.myMonth(userId, month);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
