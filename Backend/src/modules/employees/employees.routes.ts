import { Router } from "express";
import * as ctl from "./employees.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadAvatar, uploadResume } from "../../middleware/upload.js";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  CreatePositionBody,
  UpdatePositionBody,
} from "./employees.schema.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get("/", ctl.getList);
employeesRouter.post("/", requireRole("HR", "ADMIN"), validate(CreateEmployeeBody), ctl.postCreate);
employeesRouter.get("/:id", ctl.getOne);
employeesRouter.patch("/:id", validate(UpdateEmployeeBody), ctl.patchOne);
employeesRouter.post("/:id/deactivate", requireRole("HR", "ADMIN"), ctl.postDeactivate);

employeesRouter.post("/:id/avatar", uploadAvatar, ctl.postAvatar);
employeesRouter.delete("/:id/avatar", ctl.deleteAvatar);
employeesRouter.post("/:id/resume", uploadResume, ctl.postResume);
employeesRouter.delete("/:id/resume", ctl.deleteResume);

employeesRouter.get("/:id/positions", ctl.getPositions);
employeesRouter.post(
  "/:id/positions",
  requireRole("HR", "ADMIN"),
  validate(CreatePositionBody),
  ctl.postPosition,
);

export const positionsRouter = Router();
positionsRouter.use(requireAuth);
positionsRouter.patch(
  "/:id",
  requireRole("HR", "ADMIN"),
  validate(UpdatePositionBody),
  ctl.patchPosition,
);
