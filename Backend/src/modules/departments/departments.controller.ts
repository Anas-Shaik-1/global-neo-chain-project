import type { Request, Response, NextFunction } from "express";
import * as svc from "./departments.service.js";

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const result = await svc.listDepartments({
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function postCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const dept = await svc.createDepartment(req.validated as svc.CreateDeptInput);
    res.status(201).json(dept);
  } catch (err) {
    next(err);
  }
}

export async function patchOne(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const dept = await svc.updateDepartment(id, req.validated as svc.UpdateDeptInput);
    res.json(dept);
  } catch (err) {
    next(err);
  }
}

export async function deleteOne(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await svc.deleteDepartment(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
