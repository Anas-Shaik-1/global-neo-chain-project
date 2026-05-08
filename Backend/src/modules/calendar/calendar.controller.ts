import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./calendar.service.js";
import {
  CreateCalendarEventBody,
  UpdateCalendarEventBody,
} from "./calendar.schema.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
    const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    const out = await svc.listVisibleEvents(
      { id: me.id, role: me.role },
      { from, to },
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof CreateCalendarEventBody>;
    const out = await svc.createEvent({ id: me.id, role: me.role }, {
      kind: body.kind,
      visibility: body.visibility,
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      start: new Date(body.start),
      end: body.end ? new Date(body.end) : undefined,
      allDay: body.allDay,
      reminderMinutesBefore: body.reminderMinutesBefore ?? null,
      attendees: body.attendees,
    });
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const out = await svc.getEvent(id, { id: me.id, role: me.role });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const body = req.validated as z.infer<typeof UpdateCalendarEventBody>;
    const out = await svc.updateEvent(
      id,
      { id: me.id, role: me.role },
      {
        title: body.title,
        description: body.description,
        location: body.location,
        start: body.start ? new Date(body.start) : undefined,
        end: body.end ? new Date(body.end) : undefined,
        allDay: body.allDay,
        visibility: body.visibility,
        reminderMinutesBefore: body.reminderMinutesBefore,
        attendees: body.attendees,
      },
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function deleteOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    await svc.deleteEvent(id, { id: me.id, role: me.role });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ─── Meeting notes ──────────────────────────────────────────────────────────

export async function getNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const eventId = req.params.id;
    if (typeof eventId !== "string") throw new ValidationError("id is required");
    const out = await svc.listNotesForEvent(eventId, {
      id: me.id,
      role: me.role,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postNote(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const eventId = req.params.id;
    if (typeof eventId !== "string") throw new ValidationError("id is required");
    const body = (req.validated ?? req.body) as { body?: string };
    const out = await svc.createNote(
      eventId,
      { id: me.id, role: me.role },
      body.body ?? "",
    );
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function patchNote(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const noteId = req.params.noteId;
    if (typeof noteId !== "string") throw new ValidationError("noteId is required");
    const body = (req.validated ?? req.body) as { body?: string };
    const out = await svc.updateNote(
      noteId,
      { id: me.id, role: me.role },
      body.body ?? "",
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function deleteNoteCtl(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const me = requireUser(req);
    const noteId = req.params.noteId;
    if (typeof noteId !== "string") throw new ValidationError("noteId is required");
    await svc.deleteNote(noteId, { id: me.id, role: me.role });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
