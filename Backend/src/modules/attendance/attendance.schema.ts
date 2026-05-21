import { z } from "zod";
import { registry } from "../../openapi/registry.js";

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "must be a 24-char hex ObjectId");

const monthString = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM");

export const AttendanceEntry = z
  .object({
    id: z.string(),
    userId: z.string(),
    date: z.string(),
    clockIn: z.string().datetime(),
    clockOut: z.string().datetime().nullable(),
    lunchStart: z.string().datetime().nullable(),
    lunchEnd: z.string().datetime().nullable(),
    lunchMinutes: z.number().int().nonnegative(),
    durationMinutes: z.number().int().nonnegative().nullable(),
    isRemote: z.boolean(),
    isAbsent: z.boolean(),
    notes: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
  })
  .openapi("AttendanceEntry");

export const AttendanceMonthResponse = z
  .object({
    entries: z.array(AttendanceEntry),
    totalMinutes: z.number().int().nonnegative(),
    daysWorked: z.number().int().nonnegative(),
  })
  .openapi("AttendanceMonthResponse");

export const PresentTodayPerson = z
  .object({
    id: z.string(),
    name: z.string(),
    jobTitle: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    clockIn: z.string().datetime(),
    isRemote: z.boolean(),
    hasClockedOut: z.boolean(),
  })
  .openapi("PresentTodayPerson");

/** Active employees who haven't clocked in today — same shape as the
 *  present roster minus the timing/remote bits, since the only relevant
 *  fact about an absentee is who they are. */
export const NotClockedInPerson = z
  .object({
    id: z.string(),
    name: z.string(),
    jobTitle: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .openapi("NotClockedInPerson");

export const PresentTodayResponse = z
  .object({
    date: z.string(),
    presentCount: z.number().int().nonnegative(),
    remoteCount: z.number().int().nonnegative(),
    notClockedInCount: z.number().int().nonnegative(),
    people: z.array(PresentTodayPerson),
    /** Active employees who have no attendance entry today. Drives the
     *  "Awaiting clock-in" panel on the dashboard PresentToday widget. */
    notClockedIn: z.array(NotClockedInPerson),
  })
  .openapi("PresentTodayResponse");

export const ClockInBody = z
  .object({
    notes: z.string().max(500).optional(),
    isRemote: z.boolean().optional(),
    // Browser-reported coordinates. Required by the service only when the
    // server has a geofence configured AND the caller is not clocking in
    // as remote; the schema leaves them optional so dev / non-geofenced
    // deployments don't break.
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .openapi("ClockInBody");

export const ClockOutBody = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .openapi("ClockOutBody");

export const LunchBody = z.object({}).openapi("LunchBody");

/**
 * Admin-only payload to amend an attendance entry. Times are accepted as
 * either ISO strings or null (to clear). At least one editable field must be
 * present — the service checks; the schema doesn't refine to keep the OpenAPI
 * shape readable.
 */
export const AdminEditAttendanceBody = z
  .object({
    clockIn: z.string().datetime().optional(),
    clockOut: z.string().datetime().nullable().optional(),
    lunchStart: z.string().datetime().nullable().optional(),
    lunchEnd: z.string().datetime().nullable().optional(),
    isRemote: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
    /**
     * Mark / unmark the day as absent. When true, all timings collapse to
     * the entry-date midnight (duration 0). When toggled back to false the
     * admin must supply fresh clockIn / clockOut values in the same patch.
     */
    isAbsent: z.boolean().optional(),
    /** Optional reason — surfaced verbatim in the notification to the employee. */
    reason: z.string().max(200).optional(),
  })
  .openapi("AdminEditAttendanceBody");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z.object({ code: z.string(), message: z.string() }).openapi("AttendanceErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "post",
  path: "/attendance/clock-in",
  tags: ["attendance"],
  security: sec,
  request: { body: { content: { "application/json": { schema: ClockInBody } } } },
  responses: {
    201: { description: "Clocked in", ...json(AttendanceEntry) },
    409: { description: "Already clocked in today", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/attendance/clock-out",
  tags: ["attendance"],
  security: sec,
  request: { body: { content: { "application/json": { schema: ClockOutBody } } } },
  responses: {
    200: { description: "Clocked out", ...json(AttendanceEntry) },
    404: { description: "No clock-in today", ...json(ErrorRef) },
    409: { description: "Already clocked out today / less than 1h since clock-in", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/attendance/lunch-start",
  tags: ["attendance"],
  security: sec,
  request: { body: { content: { "application/json": { schema: LunchBody } } } },
  responses: {
    200: { description: "Lunch started", ...json(AttendanceEntry) },
    404: { description: "No clock-in today", ...json(ErrorRef) },
    409: { description: "Already clocked out / lunch already started", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "post",
  path: "/attendance/lunch-end",
  tags: ["attendance"],
  security: sec,
  request: { body: { content: { "application/json": { schema: LunchBody } } } },
  responses: {
    200: { description: "Lunch ended", ...json(AttendanceEntry) },
    404: { description: "No clock-in today", ...json(ErrorRef) },
    409: { description: "Lunch not started / lunch already ended", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/attendance/me",
  tags: ["attendance"],
  security: sec,
  request: {
    query: z.object({
      month: monthString.optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(AttendanceMonthResponse) },
  },
});

registry.registerPath({
  method: "get",
  path: "/attendance/employee/{userId}",
  tags: ["attendance"],
  security: sec,
  request: {
    params: z.object({ userId: objectIdString }),
    query: z.object({
      month: monthString.optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(AttendanceMonthResponse) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/attendance/today/present",
  tags: ["attendance"],
  security: sec,
  responses: {
    200: { description: "OK", ...json(PresentTodayResponse) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/attendance/{id}",
  tags: ["attendance"],
  security: sec,
  request: {
    params: z.object({ id: objectIdString }),
    body: { content: { "application/json": { schema: AdminEditAttendanceBody } } },
  },
  responses: {
    200: { description: "Updated entry", ...json(AttendanceEntry) },
    400: { description: "No editable fields", ...json(ErrorRef) },
    403: { description: "Admin only", ...json(ErrorRef) },
    404: { description: "Entry not found", ...json(ErrorRef) },
  },
});
