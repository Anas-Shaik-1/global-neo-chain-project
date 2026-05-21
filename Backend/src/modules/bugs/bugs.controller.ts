import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./bugs.service.js";
import { CreateBugBody, CreateTaskFromBugBody, UpdateBugBody } from "./bugs.schema.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import type { BugStatus } from "../../models/bug.model.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const status = typeof req.query.status === "string" ? (req.query.status as BugStatus) : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const result = await svc.listBugs({ page, limit, status, projectId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const bug = await svc.getBug(id);
    res.json(bug);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof CreateBugBody>;
    const created = await svc.createBug(
      { id: me.id, role: me.role },
      {
        title: body.title,
        description: body.description,
        projectId: body.projectId,
      },
    );
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const body = req.validated as z.infer<typeof UpdateBugBody>;
    const updated = await svc.updateBug(id, { id: me.id, role: me.role }, body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function postCreateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const body = req.validated as z.infer<typeof CreateTaskFromBugBody>;
    const updated = await svc.createTaskFromBug(
      id,
      { id: me.id, role: me.role },
      {
        projectId: body.projectId,
        assigneeId: body.assigneeId ?? null,
        priority: body.priority,
      },
    );
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function postImage(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    if (!req.file) throw new ValidationError("image file is required");
    const updated = await svc.setBugImage(
      id,
      { id: me.id, role: me.role },
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
      },
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
