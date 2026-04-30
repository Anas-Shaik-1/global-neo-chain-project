import type { Request, Response, NextFunction } from "express";
import * as svc from "./chat.service.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import { getChatNamespace } from "../../realtime/index.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function broadcastMessage(conversationId: string, msg: svc.MessageResponseShape) {
  // Best-effort socket broadcast. Null in tests / before realtime is attached.
  try {
    const ns = getChatNamespace();
    ns?.to(`conversation:${conversationId}`).emit("message", msg);
  } catch {
    // ignore — realtime is best-effort
  }
}

export async function getConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const out = await svc.listConversations(me.id);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postOpenConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as { otherUserId: string };
    const out = await svc.openConversation(me.id, body.otherUserId);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const beforeRaw = req.query.before;
    const limitRaw = req.query.limit;
    let before: Date | undefined;
    if (typeof beforeRaw === "string" && beforeRaw.length > 0) {
      const d = new Date(beforeRaw);
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError("before must be a valid ISO datetime");
      }
      before = d;
    }
    let limit: number | undefined;
    if (typeof limitRaw === "string" && limitRaw.length > 0) {
      const n = Number(limitRaw);
      if (!Number.isFinite(n) || n <= 0) {
        throw new ValidationError("limit must be a positive number");
      }
      limit = n;
    }
    const out = await svc.listMessages(id, me.id, { before, limit });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const body = req.validated as { body: string };
    const out = await svc.sendMessage(id, me.id, { body: body.body });
    broadcastMessage(id, out);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function postMessageWithAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const file = req.file;
    if (!file) throw new ValidationError("No file uploaded");
    const text =
      typeof req.body?.body === "string" ? req.body.body : "";
    const out = await svc.sendMessage(id, me.id, {
      body: text,
      attachment: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      },
    });
    broadcastMessage(id, out);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}
