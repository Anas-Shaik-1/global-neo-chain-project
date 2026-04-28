import type { Request, Response, NextFunction } from "express";
import * as svc from "./employees.service.js";
import { createFileStorage } from "../../lib/storage.js";
import { User } from "../../models/user.model.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";

const storage = createFileStorage();

function requireUser(req: Request) {
  if (!req.user) throw new ForbiddenError();
  return req.user;
}

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listEmployees({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      departmentId: typeof req.query.department === "string" ? req.query.department : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const profile = await svc.getEmployee(req.params.id!, me);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as svc.CreateInput;
    const out = await svc.createEmployee(body);
    res.status(201).json(out.profile);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const profile = await svc.updateEmployee(req.params.id!, req.validated as Record<string, unknown>, me);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function postDeactivate(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deactivate(req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function ensureSelfOrElevated(req: Request) {
  const me = requireUser(req);
  if (me.role === "HR" || me.role === "ADMIN") return;
  if (me.id !== req.params.id) throw new ForbiddenError();
}

export async function postAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const file = req.file;
    if (!file) throw new ValidationError("Missing file");
    const userId = req.params.id!;
    const u = await User.findById(userId).select("+avatarKey");
    if (!u) throw new NotFoundError("Employee");
    const saved = await storage.save("avatar", userId, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    if (u.avatarKey) await storage.delete(u.avatarKey);
    u.avatarKey = saved.key;
    u.avatarUrl = saved.url;
    await u.save();
    res.json({ avatarUrl: saved.url });
  } catch (err) {
    next(err);
  }
}

export async function deleteAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const u = await User.findById(req.params.id).select("+avatarKey");
    if (!u) throw new NotFoundError("Employee");
    if (u.avatarKey) await storage.delete(u.avatarKey);
    u.avatarKey = undefined;
    u.avatarUrl = undefined;
    await u.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postResume(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const file = req.file;
    if (!file) throw new ValidationError("Missing file");
    const userId = req.params.id!;
    const u = await User.findById(userId).select("+resumeKey");
    if (!u) throw new NotFoundError("Employee");
    const saved = await storage.save("resume", userId, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    if (u.resumeKey) await storage.delete(u.resumeKey);
    u.resumeKey = saved.key;
    u.resumeUrl = saved.url;
    await u.save();
    res.json({ resumeUrl: saved.url });
  } catch (err) {
    next(err);
  }
}

export async function deleteResume(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureSelfOrElevated(req);
    const u = await User.findById(req.params.id).select("+resumeKey");
    if (!u) throw new NotFoundError("Employee");
    if (u.resumeKey) await storage.delete(u.resumeKey);
    u.resumeKey = undefined;
    u.resumeUrl = undefined;
    await u.save();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    if (!svc.canSeeFullProfile(me, req.params.id!)) throw new ForbiddenError();
    const positions = await svc.listPositions(req.params.id!);
    res.json(positions);
  } catch (err) {
    next(err);
  }
}

export async function postPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as svc.AddPositionInput;
    const p = await svc.addPosition(req.params.id!, body);
    res.status(201).json({
      id: p._id.toString(),
      userId: p.userId.toString(),
      title: p.title,
      departmentId: p.departmentId ? p.departmentId.toString() : null,
      departmentName: null,
      employmentType: p.employmentType,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
    });
  } catch (err) {
    next(err);
  }
}

export async function patchPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const p = await svc.updatePosition(req.params.id!, req.validated as Partial<svc.AddPositionInput>);
    res.json({
      id: p._id.toString(),
      userId: p.userId.toString(),
      title: p.title,
      departmentId: p.departmentId ? p.departmentId.toString() : null,
      departmentName: null,
      employmentType: p.employmentType,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
    });
  } catch (err) {
    next(err);
  }
}
