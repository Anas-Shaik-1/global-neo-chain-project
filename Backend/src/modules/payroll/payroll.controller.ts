import type { Request, Response, NextFunction } from "express";
import * as svc from "./payroll.service.js";
import { UnauthorizedError, ValidationError } from "../../lib/errors.js";

function requireUser(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

function parseMonth(req: Request): string | undefined {
  const raw = req.query.month;
  if (typeof raw !== "string") return undefined;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return undefined;
  return raw;
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
    const month = parseMonth(req);
    const result = await svc.listMyPayslips(me.id, { month, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAllList(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit } = parsePagination(req);
    const month = parseMonth(req);
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    if (userId !== undefined && !/^[0-9a-fA-F]{24}$/.test(userId)) {
      throw new ValidationError("userId must be a 24-char hex ObjectId");
    }
    const result = await svc.listAllPayslips({ month, userId, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const body = req.validated as svc.CreatePayslipInput;
    const out = await svc.createPayslip(body, me.id);
    res.status(201).json(out);
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const out = await svc.getPayslip(id, me);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

export async function getPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const me = requireUser(req);
    const id = req.params.id as string;
    const { buffer, filename } = await svc.getOrGeneratePdf(id, me);
    res
      .contentType("application/pdf")
      .setHeader("Content-Disposition", `inline; filename="${filename}"`)
      .send(buffer);
  } catch (err) {
    next(err);
  }
}
