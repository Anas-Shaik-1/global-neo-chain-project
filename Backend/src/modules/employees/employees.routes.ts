import { Router } from "express";
import * as ctl from "./employees.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadAvatar, uploadResume } from "../../middleware/upload.js";
import {
  UpdateEmployeeBody,
  CreatePositionBody,
  UpdatePositionBody,
  RejectCandidateBody,
  ApproveHrBody,
} from "./employees.schema.js";

export const employeesRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get("/", ctl.getList);
// NOTE: legacy `POST /employees` (HR creates user) is GONE — all new users go
// through public self-registration (`POST /auth/register`) and the 2-stage
// approval workflow below.

// Approval workflow. Routes appear before `/:id` to avoid `/candidates` being
// captured as an ObjectId param.
employeesRouter.get("/candidates", requireRole("HR", "ADMIN"), ctl.getCandidates);
employeesRouter.post(
  "/:id/approve-hr",
  requireRole("HR", "ADMIN"),
  validate(ApproveHrBody),
  ctl.postApproveHr,
);
employeesRouter.post("/:id/approve-admin", requireRole("ADMIN"), ctl.postApproveAdmin);
employeesRouter.post(
  "/:id/reject",
  requireRole("HR", "ADMIN"),
  validate(RejectCandidateBody),
  ctl.postReject,
);

employeesRouter.get("/:id", ctl.getOne);
employeesRouter.patch("/:id", validate(UpdateEmployeeBody), ctl.patchOne);
employeesRouter.post("/:id/deactivate", requireRole("HR", "ADMIN"), ctl.postDeactivate);

// PM sub-role: only Admin can promote/demote. The service rejects calls
// against non-Employee targets (HR/Admin already have project-creation rights).
employeesRouter.post("/:id/promote-pm", requireRole("ADMIN"), ctl.postPromotePM);
employeesRouter.post("/:id/demote-pm", requireRole("ADMIN"), ctl.postDemotePM);

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
