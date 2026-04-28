import { Types } from "mongoose";
import { User } from "../../models/user.model.js";
import { Department } from "../../models/department.model.js";
import { Task } from "../../models/task.model.js";
import { Expense } from "../../models/expense.model.js";
import { Payslip } from "../../models/payslip.model.js";
import { Attendance, type AttendanceDoc } from "../../models/attendance.model.js";

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
