import { Router } from "express";
import * as ctl from "./dashboard.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/admin", requireRole("ADMIN"), ctl.getAdmin);
dashboardRouter.get("/hr", requireRole("HR", "ADMIN"), ctl.getHr);
dashboardRouter.get("/me", ctl.getMe);
dashboardRouter.get("/charts", ctl.getCharts);
