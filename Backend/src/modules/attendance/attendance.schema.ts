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
    durationMinutes: z.number().int().nonnegative().nullable(),
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
  })
  .openapi("ClockInBody");

export const ClockOutBody = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .openapi("ClockOutBody");

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
    409: { description: "Already clocked out today", ...json(ErrorRef) },
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
