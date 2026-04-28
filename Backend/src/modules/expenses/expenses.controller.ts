import type { Request, Response, NextFunction } from "express";
import * as svc from "./expenses.service.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";
import {
  EXPENSE_STATUSES,
  type ExpenseStatus,
} from "../../models/expense.model.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function parseStatus(req: Request): ExpenseStatus | undefined {
  const raw = req.query.status;
  if (typeof raw !== "string") return undefined;
  if (!(EXPENSE_STATUSES as readonly string[]).includes(raw)) return undefined;
  return raw as ExpenseStatus;
}

function parsePagination(req: Request) {
  const page =
    typeof req.query.page === "string" ? Number(req.query.page) : undefined;
  const limit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  return { page, limit };
}

export async function getMyList(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const { page, limit } = parsePagination(req);
    const status = parseStatus(req);
    const result = await svc.listMyExpenses(me.id, { status, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAllList(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(req);
    const status = parseStatus(req);
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    if (userId !== undefined && !/^[0-9a-fA-F]{24}$/.test(userId)) {
      throw new ValidationError("userId must be a 24-char hex ObjectId");
    }
    const result = await svc.listAll({ status, userId, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as svc.CreateExpenseInput;
    const out = await svc.createExpense(me.id, body);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const out = await svc.getExpense(id, me);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const file = req.file;
    if (!file) throw new ValidationError("Missing file");
    const out = await svc.setReceipt(id, me, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function deleteReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const out = await svc.clearReceipt(id, me);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function postDecide(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const body = req.validated as { decision: svc.ExpenseDecision; note?: string };
    const out = await svc.decideExpense(id, me.id, body.decision, body.note);
    res.json(out);
  } catch (err) {
    next(err);
  }
}
