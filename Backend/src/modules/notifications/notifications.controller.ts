import type { Request, Response, NextFunction } from "express";
import * as svc from "./notifications.service.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const unread = req.query.unread === "true";
    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const limit = Number.isFinite(limitRaw) && limitRaw && limitRaw > 0 ? limitRaw : undefined;
    const items = await svc.listMine(me.id, { unread, limit });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const count = await svc.getUnreadCount(me.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function postMarkRead(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new ValidationError("id must be a 24-char hex ObjectId");
    }
    await svc.markRead(me.id, id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function postMarkAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    await svc.markAllRead(me.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
