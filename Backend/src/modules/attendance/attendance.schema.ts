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

export const ClockInBody = z
  .object({
    notes: z.string().max(500).optional(),
    isRemote: z.boolean().optional(),
  })
  .openapi("ClockInBody");

export const ClockOutBody = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .openapi("ClockOutBody");

export const LunchBody = z.object({}).openapi("LunchBody");

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
