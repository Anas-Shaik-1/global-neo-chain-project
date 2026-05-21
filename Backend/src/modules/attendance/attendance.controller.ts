import type { Request, Response, NextFunction } from "express";
import * as svc from "./attendance.service.js";
import { UnauthorizedError } from "../../lib/errors.js";

export async function postClockIn(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const body =
      (req.validated as {
        notes?: string;
        isRemote?: boolean;
        latitude?: number;
        longitude?: number;
      } | undefined) ?? {};
    const entry = await svc.clockIn(req.user.id, {
      notes: body.notes,
      isRemote: body.isRemote,
      latitude: body.latitude,
      longitude: body.longitude,
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

export async function getPresentToday(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const result = await svc.presentToday();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function patchAttendanceEntry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) throw new UnauthorizedError();
    const id = req.params.id as string;
    const body = (req.validated ?? req.body) as {
      clockIn?: string;
      clockOut?: string | null;
      lunchStart?: string | null;
      lunchEnd?: string | null;
      isRemote?: boolean;
      isAbsent?: boolean;
      notes?: string | null;
      reason?: string;
    };
    const result = await svc.editEntryAsAdmin(id, req.user.id, {
      clockIn: body.clockIn ? new Date(body.clockIn) : undefined,
      clockOut:
        body.clockOut === undefined
          ? undefined
          : body.clockOut === null
            ? null
            : new Date(body.clockOut),
      lunchStart:
        body.lunchStart === undefined
          ? undefined
          : body.lunchStart === null
            ? null
            : new Date(body.lunchStart),
      lunchEnd:
        body.lunchEnd === undefined
          ? undefined
          : body.lunchEnd === null
            ? null
            : new Date(body.lunchEnd),
      isRemote: body.isRemote,
      isAbsent: body.isAbsent,
      notes: body.notes,
      reason: body.reason,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
