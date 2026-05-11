import { Router } from "express";
import * as ctl from "./leaves.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { CreateLeaveBody, RejectLeaveBody } from "./leaves.schema.js";

export const leavesRouter = Router();

// All endpoints require auth. Service layer enforces ADMIN-only on
// approve / reject / list-all, and owner-only on cancel.
leavesRouter.use(requireAuth);

leavesRouter.get("/mine", ctl.getMine);
leavesRouter.get("/", ctl.getAll);
leavesRouter.post("/", validate(CreateLeaveBody), ctl.postCreate);
leavesRouter.patch("/:id/approve", ctl.patchApprove);
leavesRouter.patch("/:id/reject", validate(RejectLeaveBody), ctl.patchReject);
leavesRouter.patch("/:id/cancel", ctl.patchCancel);
