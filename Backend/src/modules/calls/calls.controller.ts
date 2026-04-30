import type { Request, Response, NextFunction } from "express";
import * as svc from "./calls.service.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function postCreateCall(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const body = req.validated as { peerIds: string[] };
    const out = await svc.initiateCall(me.id, body.peerIds);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function getMyCalls(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const limitRaw = req.query.limit;
    let limit: number | undefined;
    if (typeof limitRaw === "string" && limitRaw.length > 0) {
      const n = Number(limitRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new ValidationError("limit must be a positive number");
      }
      limit = n;
    }
    const out = await svc.listMyCalls(me.id, { limit });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postEndCall(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const out = await svc.endCall(id, me.id, "HANGUP");
    res.json(out);
  } catch (err) {
    next(err);
  }
}
