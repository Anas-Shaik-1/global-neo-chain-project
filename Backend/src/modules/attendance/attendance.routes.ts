import { Router } from "express";
import * as ctl from "./attendance.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  AdminEditAttendanceBody,
  ClockInBody,
  ClockOutBody,
  LunchBody,
} from "./attendance.schema.js";

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

attendanceRouter.post("/clock-in", validate(ClockInBody), ctl.postClockIn);
attendanceRouter.post("/clock-out", validate(ClockOutBody), ctl.postClockOut);
attendanceRouter.post("/lunch-start", validate(LunchBody), ctl.postLunchStart);
attendanceRouter.post("/lunch-end", validate(LunchBody), ctl.postLunchEnd);
attendanceRouter.get("/me", ctl.getMyMonth);
// Public-to-authenticated: who is in today. Drives the dashboard widget
// every role sees. Sensitive bits (notes, lunch timings) are intentionally
// NOT included in the response shape — only name, role, clock-in time.
attendanceRouter.get("/today/present", ctl.getPresentToday);
attendanceRouter.get(
  "/employee/:userId",
  requireRole("HR", "ADMIN"),
  ctl.getEmployeeMonth,
);

// Admin amendment of any employee's attendance entry. Notifies the employee
// on success so the change isn't silent.
attendanceRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validate(AdminEditAttendanceBody),
  ctl.patchAttendanceEntry,
);
