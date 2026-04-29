import { Router } from "express";
import * as ctl from "./attendance.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ClockInBody, ClockOutBody, LunchBody } from "./attendance.schema.js";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

attendanceRouter.post("/clock-in", validate(ClockInBody), ctl.postClockIn);
attendanceRouter.post("/clock-out", validate(ClockOutBody), ctl.postClockOut);
attendanceRouter.post("/lunch-start", validate(LunchBody), ctl.postLunchStart);
attendanceRouter.post("/lunch-end", validate(LunchBody), ctl.postLunchEnd);
attendanceRouter.get("/me", ctl.getMyMonth);
attendanceRouter.get(
  "/employee/:userId",
  requireRole("HR", "ADMIN"),
  ctl.getEmployeeMonth,
);
