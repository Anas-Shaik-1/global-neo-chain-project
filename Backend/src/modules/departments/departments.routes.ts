import { Router } from "express";
import * as ctl from "./departments.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { CreateDepartmentBody, UpdateDepartmentBody } from "./departments.schema.js";

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get("/", ctl.getList);
departmentsRouter.post("/", requireRole("HR", "ADMIN"), validate(CreateDepartmentBody), ctl.postCreate);
departmentsRouter.patch("/:id", requireRole("HR", "ADMIN"), validate(UpdateDepartmentBody), ctl.patchOne);
departmentsRouter.delete("/:id", requireRole("ADMIN"), ctl.deleteOne);
