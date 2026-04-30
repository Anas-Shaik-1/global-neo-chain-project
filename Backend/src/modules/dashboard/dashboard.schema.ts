import { z } from "zod";
import { registry } from "../../openapi/registry.js";

const RecentJoiner = z
  .object({
    id: z.string(),
    name: z.string(),
    jobTitle: z.string().nullable(),
    hireDate: z.string().datetime().nullable(),
  })
  .openapi("DashboardRecentJoiner");

export const AdminStatsResponse = z
  .object({
    totalEmployees: z.number().int().nonnegative(),
    activeEmployees: z.number().int().nonnegative(),
    departmentCount: z.number().int().nonnegative(),
    openTasks: z.number().int().nonnegative(),
    pendingExpenses: z.number().int().nonnegative(),
    payrollMonth: z.string().nullable(),
    totalPayrollNet: z.number().int().nonnegative(),
    recentJoiners: z.array(RecentJoiner),
  })
  .openapi("DashboardAdminStats");

const DepartmentBreakdown = z
  .object({
    departmentId: z.string(),
    departmentName: z.string(),
    employeeCount: z.number().int().nonnegative(),
  })
  .openapi("DashboardDepartmentBreakdown");

export const HrStatsResponse = z
  .object({
    totalEmployees: z.number().int().nonnegative(),
    activeEmployees: z.number().int().nonnegative(),
    inactiveEmployees: z.number().int().nonnegative(),
    pendingExpensesCount: z.number().int().nonnegative(),
    pendingExpensesAmount: z.number().int().nonnegative(),
    attendanceTodayCount: z.number().int().nonnegative(),
    attendanceClockedInNow: z.number().int().nonnegative(),
    departmentBreakdown: z.array(DepartmentBreakdown),
  })
  .openapi("DashboardHrStats");

const AttendanceEntry = z
  .object({
    id: z.string(),
    userId: z.string(),
    date: z.string(),
    clockIn: z.string().datetime(),
    clockOut: z.string().datetime().nullable(),
    durationMinutes: z.number().int().nullable(),
    notes: z.string().nullable(),
  })
  .openapi("DashboardAttendanceEntry");

const LatestPayslip = z
  .object({
    month: z.string(),
    netAmount: z.number().int().nonnegative(),
    currency: z.string().length(3),
  })
  .openapi("DashboardLatestPayslip");

export const EmployeeStatsResponse = z
  .object({
    todayAttendance: AttendanceEntry.nullable(),
    monthHoursMinutes: z.number().int().nonnegative(),
    monthDaysWorked: z.number().int().nonnegative(),
    myOpenTasks: z.number().int().nonnegative(),
    myDoneTasksThisMonth: z.number().int().nonnegative(),
    myPendingExpenses: z.number().int().nonnegative(),
    myApprovedExpensesThisMonth: z.number().int().nonnegative(),
    latestPayslip: LatestPayslip.nullable(),
    unreadMessages: z.number().int().nonnegative(),
  })
  .openapi("DashboardEmployeeStats");

const json = (schema: z.ZodTypeAny) => ({ content: { "application/json": { schema } } });
const ErrorRef = z
  .object({ code: z.string(), message: z.string() })
  .openapi("DashboardErrorRef");
const sec = [{ bearerAuth: [] as string[] }];

registry.registerPath({
  method: "get",
  path: "/dashboard/admin",
  tags: ["dashboard"],
  security: sec,
  responses: {
    200: { description: "OK", ...json(AdminStatsResponse) },
    401: { description: "Unauthorized", ...json(ErrorRef) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/dashboard/hr",
  tags: ["dashboard"],
  security: sec,
  responses: {
    200: { description: "OK", ...json(HrStatsResponse) },
    401: { description: "Unauthorized", ...json(ErrorRef) },
    403: { description: "Forbidden", ...json(ErrorRef) },
  },
});

registry.registerPath({
  method: "get",
  path: "/dashboard/me",
  tags: ["dashboard"],
  security: sec,
  responses: {
    200: { description: "OK", ...json(EmployeeStatsResponse) },
    401: { description: "Unauthorized", ...json(ErrorRef) },
  },
});

const SeriesPoint = z
  .object({
    bucket: z.string(),
    value: z.number().int().nonnegative(),
  })
  .openapi("DashboardSeriesPoint");

export const ChartsResponse = z
  .object({
    attendance: z.array(SeriesPoint),
    expenses: z.array(SeriesPoint),
    payroll: z.array(SeriesPoint),
  })
  .openapi("DashboardChartsResponse");

registry.registerPath({
  method: "get",
  path: "/dashboard/charts",
  tags: ["dashboard"],
  security: sec,
  request: {
    query: z.object({
      granularity: z.enum(["day", "month", "year"]).default("month").optional(),
      userId: z.string().optional(),
    }),
  },
  responses: {
    200: { description: "OK", ...json(ChartsResponse) },
    400: { description: "Bad request", ...json(ErrorRef) },
    401: { description: "Unauthorized", ...json(ErrorRef) },
  },
});
