import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import * as svc from "./chat.service.js";
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "../../lib/errors.js";
import { Conversation } from "../../models/conversation.model.js";
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

export async function postMarkConversationRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      throw new ValidationError("id must be a 24-char hex ObjectId");
    }
    const out = await svc.markConversationRead(me.id, id);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function getUnreadTotal(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const count = await svc.getTotalUnread(me.id);
    res.json({ count });
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
    // Defense-in-depth: confirm the requester is a participant before we touch
    // storage. Multer (route-level) has already buffered the bytes by the time
    // we get here, so we can't avoid the upload itself — fully avoiding it
    // requires moving this check into a route-level middleware in
    // chat.routes.ts ahead of `uploadChatAttachment`. We can't edit
    // chat.routes.ts from here, so this is the best we can do for now.
    // TODO(attachment-preflight): add a participant-check middleware in
    // chat.routes.ts before `uploadChatAttachment` so non-participants don't
    // even get to upload bytes.
    if (!Types.ObjectId.isValid(id)) {
      throw new ValidationError("id must be a 24-char hex ObjectId");
    }
    const isParticipant = await Conversation.exists({
      _id: id,
      participantIds: me.id,
    });
    if (!isParticipant) throw new ForbiddenError();

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

export async function postCreateGroup(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const body = req.validated as { name: string; participantIds: string[] };
    const out = await svc.createGroup(me.id, body);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function postAddGroupMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const body = req.validated as { userId: string };
    const out = await svc.addGroupMember(id, me.id, body.userId);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function deleteGroupMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const out = await svc.removeGroupMember(id, me.id, userId);
    res.json(out);
  } catch (err) {
    next(err);
  }
}
