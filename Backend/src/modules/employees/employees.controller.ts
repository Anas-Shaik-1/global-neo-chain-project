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
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const department = typeof req.query.department === "string" ? req.query.department : undefined;
    const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await svc.listEmployees({
      q,
      departmentId: department,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const profile = await svc.getEmployee(id, me);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// NOTE: the legacy `postCreate` (HR-creates-employee) handler was removed when
// the self-registration + 2-stage approval pipeline went in. New users must go
// through POST /auth/register (registration module).

export async function getCandidates(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const stageRaw = typeof req.query.stage === "string" ? req.query.stage : "hr";
    if (stageRaw !== "hr" && stageRaw !== "admin") {
      throw new ValidationError("stage must be 'hr' or 'admin'");
    }
    if (stageRaw === "admin" && me.role !== "ADMIN") {
      throw new ForbiddenError("Only Admin can view the admin candidate queue");
    }
    const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await svc.listCandidates({ stage: stageRaw, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postApproveHr(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    // departmentId is optional in the body — when present, the HR is also
    // placing the candidate at approval time. Validation (24-hex / null) is
    // handled in the service against the Department collection.
    const body = (req.validated ?? req.body) as { departmentId?: string | null };
    const out = await svc.approveAtHrStage(id, me.id, {
      departmentId: body?.departmentId,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postApproveAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const out = await svc.approveAtAdminStage(id, me.id);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postReject(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const body = (req.validated ?? req.body) as { notes?: string };
    const out = await svc.rejectCandidate(id, me.id, me.role, body?.notes);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const profile = await svc.updateEmployee(id, req.validated as Record<string, unknown>, me);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function postDeactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await svc.deactivate(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function postPromotePM(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const out = await svc.setProjectManager(id, true);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postDemotePM(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const out = await svc.setProjectManager(id, false);
    res.json(out);
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
    const userId = req.params.id as string;
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
    u.avatarVariants = saved.variants
      ? {
          small: saved.variants.small,
          medium: saved.variants.medium,
          large: saved.variants.large,
        }
      : { small: null, medium: null, large: null };
    await u.save();
    res.json({
      avatarUrl: saved.url,
      avatarVariants: saved.variants ?? null,
    });
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
    u.avatarVariants = { small: null, medium: null, large: null };
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
    const userId = req.params.id as string;
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
    const id = req.params.id as string;
    if (!svc.canSeeFullProfile(me, id)) throw new ForbiddenError();
    const positions = await svc.listPositions(id);
    res.json(positions);
  } catch (err) {
    next(err);
  }
}

export async function postPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.validated as svc.AddPositionInput;
    const id = req.params.id as string;
    const p = await svc.addPosition(id, body);
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
    const id = req.params.id as string;
    const p = await svc.updatePosition(id, req.validated as Partial<svc.AddPositionInput>);
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
