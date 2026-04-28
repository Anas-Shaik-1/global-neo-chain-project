import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

beforeAll(async () => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
  await startTestDb();
  const { User } = await import("../../models/user.model.js");
  await User.init();
  const { Expense } = await import("../../models/expense.model.js");
  await Expense.init();
  const { Payslip } = await import("../../models/payslip.model.js");
  await Payslip.init();
  const { Attendance } = await import("../../models/attendance.model.js");
  await Attendance.init();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function makeUser(
  email: string,
  role: "EMPLOYEE" | "HR" | "ADMIN" = "EMPLOYEE",
  isActive = true,
) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
    isActive,
  });
}

describe("dashboard.service", () => {
  it("adminStats returns zeros when database is empty", async () => {
    const { adminStats } = await import("./dashboard.service.js");
    const out = await adminStats();
    expect(out.totalEmployees).toBe(0);
    expect(out.activeEmployees).toBe(0);
    expect(out.departmentCount).toBe(0);
    expect(out.openTasks).toBe(0);
    expect(out.pendingExpenses).toBe(0);
    expect(out.payrollMonth).toBeNull();
    expect(out.totalPayrollNet).toBe(0);
    expect(out.recentJoiners).toEqual([]);
  });

  it("hrStats counts active vs inactive employees", async () => {
    const { hrStats } = await import("./dashboard.service.js");
    await makeUser("a@b.com", "EMPLOYEE", true);
    await makeUser("b@b.com", "EMPLOYEE", true);
    await makeUser("c@b.com", "EMPLOYEE", false);
    const out = await hrStats();
    expect(out.totalEmployees).toBe(3);
    expect(out.activeEmployees).toBe(2);
    expect(out.inactiveEmployees).toBe(1);
    expect(Array.isArray(out.departmentBreakdown)).toBe(true);
  });

  it("employeeStats returns own counts (open tasks, pending expenses)", async () => {
    const { employeeStats } = await import("./dashboard.service.js");
    const { Task } = await import("../../models/task.model.js");
    const { Project } = await import("../../models/project.model.js");
    const { Expense } = await import("../../models/expense.model.js");
    const me = await makeUser("me@b.com");
    const other = await makeUser("other@b.com");
    const project = await Project.create({
      name: "P",
      key: "p",
    });
    // 2 open tasks for me, 1 done, 1 unassigned to other
    await Task.create({
      projectId: project._id,
      title: "t1",
      status: "TODO",
      assigneeId: me._id,
      createdById: me._id,
    });
    await Task.create({
      projectId: project._id,
      title: "t2",
      status: "IN_PROGRESS",
      assigneeId: me._id,
      createdById: me._id,
    });
    await Task.create({
      projectId: project._id,
      title: "t3",
      status: "DONE",
      assigneeId: me._id,
      createdById: me._id,
    });
    await Task.create({
      projectId: project._id,
      title: "t4",
      status: "TODO",
      assigneeId: other._id,
      createdById: other._id,
    });
    // 1 pending expense for me
    await Expense.create({
      userId: me._id,
      amount: 500,
      currency: "USD",
      category: "MEALS",
      description: "lunch",
      incurredOn: new Date(),
      status: "PENDING",
    });
    const out = await employeeStats(me._id.toString());
    expect(out.myOpenTasks).toBe(2);
    expect(out.myDoneTasksThisMonth).toBe(1);
    expect(out.myPendingExpenses).toBe(1);
    expect(out.unreadMessages).toBe(0);
  });

  it("employeeStats returns null latestPayslip when no payslips exist", async () => {
    const { employeeStats } = await import("./dashboard.service.js");
    const me = await makeUser("me@b.com");
    const out = await employeeStats(me._id.toString());
    expect(out.latestPayslip).toBeNull();
    expect(out.todayAttendance).toBeNull();
    expect(out.monthHoursMinutes).toBe(0);
    expect(out.monthDaysWorked).toBe(0);
    expect(out.myApprovedExpensesThisMonth).toBe(0);
  });
});
