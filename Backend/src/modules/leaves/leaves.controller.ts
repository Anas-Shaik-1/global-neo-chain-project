import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./leaves.service.js";
import { CreateLeaveBody, RejectLeaveBody } from "./leaves.schema.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import type { LeaveStatus, LeaveType } from "../../models/leaveRequest.model.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function readPaging(req: Request) {
  return {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof CreateLeaveBody>;
    const created = await svc.createLeave({ id: me.id, role: me.role }, body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

export async function getMine(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const { page, limit } = readPaging(req);
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as LeaveStatus)
        : undefined;
    const type =
      typeof req.query.type === "string" ? (req.query.type as LeaveType) : undefined;
    const result = await svc.listMineLeaves(me.id, { page, limit, status, type });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const { page, limit } = readPaging(req);
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as LeaveStatus)
        : undefined;
    const type =
      typeof req.query.type === "string" ? (req.query.type as LeaveType) : undefined;
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const result = await svc.listAllLeaves(
      { id: me.id, role: me.role },
      { page, limit, status, type, userId, from, to },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function patchApprove(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const updated = await svc.approveLeave(id, { id: me.id, role: me.role });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function patchReject(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const body = req.validated as z.infer<typeof RejectLeaveBody>;
    const updated = await svc.rejectLeave(
      id,
      { id: me.id, role: me.role },
      { notes: body.notes },
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function patchCancel(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const updated = await svc.cancelLeave(id, { id: me.id, role: me.role });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
