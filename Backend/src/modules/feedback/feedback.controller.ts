import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as svc from "./feedback.service.js";
import {
  SubmitFeedbackBody,
  ReviewFeedbackBody,
} from "./feedback.schema.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function postSubmit(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as z.infer<typeof SubmitFeedbackBody>;
    const out = await svc.submitFeedback(me.id, {
      kind: body.kind,
      subject: body.subject,
      body: body.body,
      isAnonymous: body.isAnonymous,
    });
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const mine = req.query.mine === "true";
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as svc.ReviewFeedbackInput["status"])
        : undefined;
    const kind =
      typeof req.query.kind === "string"
        ? (req.query.kind as "SUGGESTION" | "COMPLAINT")
        : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const out = await svc.listFeedback(
      { id: me.id, role: me.role },
      { mine, status, kind, page, limit },
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const out = await svc.getFeedback(id, { id: me.id, role: me.role });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postReview(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id;
    if (typeof id !== "string") throw new ValidationError("id is required");
    const body = req.validated as z.infer<typeof ReviewFeedbackBody>;
    const out = await svc.reviewFeedback(
      id,
      { id: me.id, role: me.role },
      { status: body.status, reviewNote: body.reviewNote },
    );
    res.json(out);
  } catch (err) {
    next(err);
  }
}
