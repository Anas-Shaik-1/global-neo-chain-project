import { Router } from "express";
import * as ctl from "./payroll.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { CreatePayslipBody } from "./payroll.schema.js";

export const payrollRouter = Router();

payrollRouter.use(requireAuth);

payrollRouter.get("/me", ctl.getMyList);
payrollRouter.get("/", requireRole("HR", "ADMIN"), ctl.getAllList);
payrollRouter.post(
  "/",
  requireRole("HR", "ADMIN"),
  validate(CreatePayslipBody),
  ctl.postCreate,
);
payrollRouter.get("/:id", ctl.getOne);
payrollRouter.get("/:id/pdf", ctl.getPdf);
