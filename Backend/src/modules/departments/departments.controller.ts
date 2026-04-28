import type { Request, Response, NextFunction } from "express";
import * as svc from "./departments.service.js";

export async function getList(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await svc.listDepartments({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
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
    const dept = await svc.updateDepartment(req.params.id!, req.validated as svc.UpdateDeptInput);
    res.json(dept);
  } catch (err) {
    next(err);
  }
}

export async function deleteOne(req: Request, res: Response, next: NextFunction) {
  try {
    await svc.deleteDepartment(req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
