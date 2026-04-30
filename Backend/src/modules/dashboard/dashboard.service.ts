import { Types } from "mongoose";
import { User } from "../../models/user.model.js";
import { Department } from "../../models/department.model.js";
import { Task } from "../../models/task.model.js";
import { Expense } from "../../models/expense.model.js";
import { Payslip } from "../../models/payslip.model.js";
import { Attendance, type AttendanceDoc } from "../../models/attendance.model.js";
import { toInrCents } from "../../lib/currency.js";

export interface RecentJoiner {
  id: string;
  name: string;
  jobTitle: string | null;
  hireDate: Date | null;
}

export interface AdminStats {
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  openTasks: number;
  pendingExpenses: number;
  payrollMonth: string | null;
  totalPayrollNet: number;
  recentJoiners: RecentJoiner[];
}

export interface DepartmentBreakdownEntry {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
}

export interface HrStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  pendingExpensesCount: number;
  pendingExpensesAmount: number;
  attendanceTodayCount: number;
  attendanceClockedInNow: number;
  departmentBreakdown: DepartmentBreakdownEntry[];
}

export interface AttendanceEntryShape {
  id: string;
  userId: string;
  date: string;
  clockIn: Date;
  clockOut: Date | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface LatestPayslipShape {
  month: string;
  netAmount: number;
  currency: string;
}

export interface EmployeeStats {
  todayAttendance: AttendanceEntryShape | null;
  monthHoursMinutes: number;
  monthDaysWorked: number;
  myOpenTasks: number;
  myDoneTasksThisMonth: number;
  myPendingExpenses: number;
  myApprovedExpensesThisMonth: number;
  latestPayslip: LatestPayslipShape | null;
  unreadMessages: number;
}

function todayUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentMonthUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthBoundaryUtc(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, end };
}

function durationMinutes(clockIn: Date, clockOut: Date | null): number | null {
  if (!clockOut) return null;
  const diffMs = clockOut.getTime() - clockIn.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / 60000);
}

function attendanceToShape(doc: AttendanceDoc): AttendanceEntryShape {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    date: doc.date,
    clockIn: doc.clockIn,
    clockOut: doc.clockOut ?? null,
    durationMinutes: durationMinutes(doc.clockIn, doc.clockOut ?? null),
    notes: doc.notes ?? null,
  };
}

export async function adminStats(): Promise<AdminStats> {
  const [
    totalEmployees,
    activeEmployees,
    departmentCount,
    openTasks,
    pendingExpenses,
    latestPayslip,
    recentJoinerDocs,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    Department.countDocuments({}),
    Task.countDocuments({ status: { $ne: "DONE" } }),
    Expense.countDocuments({ status: "PENDING" }),
    Payslip.findOne({}).sort({ month: -1, createdAt: -1 }).lean(),
    User.find({ hireDate: { $ne: null } })
      .sort({ hireDate: -1 })
      .limit(5)
      .select("_id name jobTitle hireDate")
      .lean(),
  ]);

  let payrollMonth: string | null = null;
  let totalPayrollNet = 0;
  if (latestPayslip) {
    payrollMonth = latestPayslip.month;
    const agg = await Payslip.aggregate<{ _id: null; total: number }>([
      { $match: { month: latestPayslip.month } },
      { $group: { _id: null, total: { $sum: "$netAmount" } } },
    ]);
    totalPayrollNet = agg[0]?.total ?? 0;
  }

  const recentJoiners: RecentJoiner[] = recentJoinerDocs.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    jobTitle: u.jobTitle ?? null,
    hireDate: u.hireDate ?? null,
  }));

  return {
    totalEmployees,
    activeEmployees,
    departmentCount,
    openTasks,
    pendingExpenses,
    payrollMonth,
    totalPayrollNet,
    recentJoiners,
  };
}

export async function hrStats(): Promise<HrStats> {
  const today = todayUtc();
  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    pendingExpensesCount,
    pendingAgg,
    attendanceTodayCount,
    attendanceClockedInNow,
    departmentDocs,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: false }),
    Expense.countDocuments({ status: "PENDING" }),
    Expense.aggregate<{ _id: null; total: number }>([
      { $match: { status: "PENDING" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Attendance.countDocuments({ date: today }),
    Attendance.countDocuments({ date: today, clockOut: null }),
    Department.find({}).select("_id name").lean(),
  ]);

  const pendingExpensesAmount = pendingAgg[0]?.total ?? 0;

  // Build department breakdown by counting users per department for departments
  // present in the system. Top 5 by count desc.
  const userCountsAgg = await User.aggregate<{ _id: Types.ObjectId | null; count: number }>([
    { $match: { departmentId: { $ne: null } } },
    { $group: { _id: "$departmentId", count: { $sum: 1 } } },
  ]);
  const countByDept = new Map<string, number>();
  for (const row of userCountsAgg) {
    if (row._id) countByDept.set(row._id.toString(), row.count);
  }
  const breakdown: DepartmentBreakdownEntry[] = departmentDocs.map((d) => ({
    departmentId: d._id.toString(),
    departmentName: d.name,
    employeeCount: countByDept.get(d._id.toString()) ?? 0,
  }));
  breakdown.sort((a, b) => b.employeeCount - a.employeeCount);
  const departmentBreakdown = breakdown.slice(0, 5);

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    pendingExpensesCount,
    pendingExpensesAmount,
    attendanceTodayCount,
    attendanceClockedInNow,
    departmentBreakdown,
  };
}

export async function employeeStats(userId: string): Promise<EmployeeStats> {
  const oid = new Types.ObjectId(userId);
  const today = todayUtc();
  const month = currentMonthUtc();
  const { start: monthStart, end: monthEnd } = monthBoundaryUtc();

  const [
    todayDoc,
    monthEntries,
    myOpenTasks,
    myDoneTasksThisMonth,
    myPendingExpenses,
    approvedAgg,
    latestPayslipDoc,
  ] = await Promise.all([
    Attendance.findOne({ userId: oid, date: today }),
    Attendance.find({
      userId: oid,
      date: { $regex: `^${month}` },
    }),
    Task.countDocuments({ assigneeId: oid, status: { $ne: "DONE" } }),
    Task.countDocuments({
      assigneeId: oid,
      status: "DONE",
      updatedAt: { $gte: monthStart, $lt: monthEnd },
    }),
    Expense.countDocuments({ userId: oid, status: "PENDING" }),
    Expense.aggregate<{ _id: null; total: number }>([
      {
        $match: {
          userId: oid,
          status: "APPROVED",
          decidedAt: { $gte: monthStart, $lt: monthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Payslip.findOne({ userId: oid }).sort({ month: -1, createdAt: -1 }).lean(),
  ]);

  let monthHoursMinutes = 0;
  let monthDaysWorked = 0;
  for (const e of monthEntries) {
    if (e.clockOut) {
      const mins = durationMinutes(e.clockIn, e.clockOut);
      if (mins !== null) monthHoursMinutes += mins;
      monthDaysWorked += 1;
    }
  }

  const latestPayslip: LatestPayslipShape | null = latestPayslipDoc
    ? {
        month: latestPayslipDoc.month,
        netAmount: latestPayslipDoc.netAmount,
        currency: latestPayslipDoc.currency,
      }
    : null;

  return {
    todayAttendance: todayDoc ? attendanceToShape(todayDoc) : null,
    monthHoursMinutes,
    monthDaysWorked,
    myOpenTasks,
    myDoneTasksThisMonth,
    myPendingExpenses,
    myApprovedExpensesThisMonth: approvedAgg[0]?.total ?? 0,
    latestPayslip,
    unreadMessages: 0,
  };
}

// ---------------------------------------------------------------------------
// Chart series (daily / monthly / yearly trends)
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  bucket: string;
  value: number;
}

export interface ChartsResponse {
  attendance: SeriesPoint[];
  expenses: SeriesPoint[];
  payroll: SeriesPoint[];
}

export type Granularity = "day" | "month" | "year";

interface BucketSpec {
  format: string;        // $dateToString format
  count: number;         // how many buckets to backfill
  step: (start: Date, i: number) => Date; // produce date i steps before "now"
  label: (d: Date) => string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function bucketSpec(granularity: Granularity, now: Date): BucketSpec {
  if (granularity === "day") {
    return {
      format: "%Y-%m-%d",
      count: 14,
      step: (start, i) => {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() - i);
        return d;
      },
      label: (d) =>
        `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    };
  }
  if (granularity === "month") {
    return {
      format: "%Y-%m",
      count: 12,
      step: (start, i) => {
        const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 1));
        return d;
      },
      label: (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`,
    };
  }
  return {
    format: "%Y",
    count: 5,
    step: (start, i) => new Date(Date.UTC(start.getUTCFullYear() - i, 0, 1)),
    label: (d) => `${d.getUTCFullYear()}`,
  };
}

function buildBuckets(spec: BucketSpec, now: Date): string[] {
  // newest -> oldest, then reverse for chronological ordering
  const labels: string[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    labels.push(spec.label(spec.step(now, i)));
  }
  return labels.reverse();
}

function rangeStart(spec: BucketSpec, now: Date): Date {
  // The earliest moment any data we want should fall on/after.
  const oldest = spec.step(now, spec.count - 1);
  // Normalise to bucket start for safety.
  return new Date(
    Date.UTC(
      oldest.getUTCFullYear(),
      // For "year" granularity, oldest is already Jan 1; for "month" it's the 1st;
      // for "day" we keep day boundaries.
      oldest.getUTCMonth(),
      oldest.getUTCDate(),
      0, 0, 0, 0,
    ),
  );
}

function fillSeries(buckets: string[], data: Map<string, number>): SeriesPoint[] {
  return buckets.map((b) => ({ bucket: b, value: data.get(b) ?? 0 }));
}

export async function chartSeries(opts: {
  granularity: Granularity;
  userId?: string;
  now?: Date;
}): Promise<ChartsResponse> {
  const now = opts.now ?? new Date();
  const spec = bucketSpec(opts.granularity, now);
  const buckets = buildBuckets(spec, now);
  const start = rangeStart(spec, now);
  const userOid = opts.userId ? new Types.ObjectId(opts.userId) : null;

  // Attendance: total worked minutes per bucket (only completed entries).
  const attendanceMatch: Record<string, unknown> = {
    clockOut: { $ne: null },
    clockIn: { $gte: start },
  };
  if (userOid) attendanceMatch.userId = userOid;
  const attendanceAgg = await Attendance.aggregate<{ _id: string; value: number }>([
    { $match: attendanceMatch },
    {
      $project: {
        bucket: { $dateToString: { format: spec.format, date: "$clockIn" } },
        durationMs: { $subtract: ["$clockOut", "$clockIn"] },
      },
    },
    {
      $group: {
        _id: "$bucket",
        // Convert milliseconds to minutes; clamp to >= 0 for safety.
        value: { $sum: { $max: [0, { $floor: { $divide: ["$durationMs", 60000] } }] } },
      },
    },
  ]);
  const attendanceMap = new Map<string, number>();
  for (const row of attendanceAgg) attendanceMap.set(row._id, row.value);

  // Expenses: APPROVED per bucket grouped by currency, then convert to INR cents.
  const expenseMatch: Record<string, unknown> = {
    status: "APPROVED",
    decidedAt: { $ne: null, $gte: start },
  };
  if (userOid) expenseMatch.userId = userOid;
  const expenseAgg = await Expense.aggregate<{ _id: { bucket: string; currency: string }; value: number }>([
    { $match: expenseMatch },
    {
      $group: {
        _id: {
          bucket: { $dateToString: { format: spec.format, date: "$decidedAt" } },
          currency: "$currency",
        },
        value: { $sum: "$amount" },
      },
    },
  ]);
  const expenseMap = new Map<string, number>();
  for (const row of expenseAgg) {
    const inr = toInrCents(row.value, row._id.currency);
    expenseMap.set(row._id.bucket, (expenseMap.get(row._id.bucket) ?? 0) + inr);
  }

  // Payroll: net amount per bucket. Payslips are stored with a `month` string
  // ("YYYY-MM"), and `createdAt` carries the actual generation time. Group by
  // createdAt so the bucket aligns with the calendar period the chart shows.
  const payrollMatch: Record<string, unknown> = {
    createdAt: { $gte: start },
  };
  if (userOid) payrollMatch.userId = userOid;
  const payrollAgg = await Payslip.aggregate<{ _id: { bucket: string; currency: string }; value: number }>([
    { $match: payrollMatch },
    {
      $group: {
        _id: {
          bucket: { $dateToString: { format: spec.format, date: "$createdAt" } },
          currency: "$currency",
        },
        value: { $sum: "$netAmount" },
      },
    },
  ]);
  const payrollMap = new Map<string, number>();
  for (const row of payrollAgg) {
    const inr = toInrCents(row.value, row._id.currency);
    payrollMap.set(row._id.bucket, (payrollMap.get(row._id.bucket) ?? 0) + inr);
  }

  return {
    attendance: fillSeries(buckets, attendanceMap),
    expenses: fillSeries(buckets, expenseMap),
    payroll: fillSeries(buckets, payrollMap),
  };
}
