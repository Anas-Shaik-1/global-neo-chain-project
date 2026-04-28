import { useQuery } from "@tanstack/react-query";
import { getApi } from "@/api/axios";
import { useAppSelector } from "@/app/hooks";

const api = () => getApi();

export const dashboardKeys = {
  all: ["dashboard"] as const,
  admin: ["dashboard", "admin"] as const,
  hr: ["dashboard", "hr"] as const,
  me: ["dashboard", "me"] as const,
};

export interface RecentJoiner {
  id: string;
  name: string;
  jobTitle: string | null;
  hireDate: string | null;
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
  clockIn: string;
  clockOut: string | null;
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

export function useEmployeeStats() {
  const isAuthed = useAppSelector((s) => !!s.auth.user);
  return useQuery({
    queryKey: dashboardKeys.me,
    enabled: isAuthed,
    queryFn: async () => {
      const res = await api().get("/dashboard/me");
      return res.data as EmployeeStats;
    },
  });
}

export function useHRStats() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const enabled = role === "HR" || role === "ADMIN";
  return useQuery({
    queryKey: dashboardKeys.hr,
    enabled,
    queryFn: async () => {
      const res = await api().get("/dashboard/hr");
      return res.data as HrStats;
    },
  });
}

export function useAdminStats() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const enabled = role === "ADMIN";
  return useQuery({
    queryKey: dashboardKeys.admin,
    enabled,
    queryFn: async () => {
      const res = await api().get("/dashboard/admin");
      return res.data as AdminStats;
    },
  });
}
