import { Link } from "react-router-dom";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ListChecks,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { MetricCard } from "@/components/common/MetricCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useAppSelector } from "@/app/hooks";
import {
  useAdminStats,
  useEmployeeStats,
  useHRStats,
  type AdminStats,
  type EmployeeStats,
  type HrStats,
} from "../api/hooks";

const METRIC_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
const TWO_COL = "grid grid-cols-1 gap-4 lg:grid-cols-2";

function formatCents(amount: number, currency = "USD"): string {
  const major = amount / 100;
  return `${major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return d.toLocaleDateString();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function describeAttendance(att: EmployeeStats["todayAttendance"]): string {
  if (!att) return "Not clocked in";
  if (!att.clockOut) return `Clocked in at ${formatTime(att.clockIn)}`;
  const hours =
    typeof att.durationMinutes === "number"
      ? Math.round((att.durationMinutes / 60) * 10) / 10
      : 0;
  return `Clocked out (${hours}h)`;
}

function MetricSkeletonRow() {
  return (
    <div className={METRIC_GRID}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

function EmployeeSection({ data }: { data: EmployeeStats | undefined }) {
  if (!data) return <MetricSkeletonRow />;
  const { todayAttendance, monthHoursMinutes, monthDaysWorked, myOpenTasks, myApprovedExpensesThisMonth, myPendingExpenses, latestPayslip } = data;
  return (
    <div className="space-y-6">
      <div className={METRIC_GRID}>
        <MetricCard
          label="Today's status"
          value={
            <span className="text-xl">{describeAttendance(todayAttendance)}</span>
          }
          icon={<Clock className="h-5 w-5" />}
          accent
        />
        <MetricCard
          label="Hours this month"
          value={<span className="font-mono">{formatHoursMinutes(monthHoursMinutes)}</span>}
          hint={`${monthDaysWorked} days worked`}
          icon={<Calendar className="h-5 w-5" />}
        />
        <MetricCard
          label="Open tasks"
          value={myOpenTasks}
          hint="Across all projects"
          icon={<ListChecks className="h-5 w-5" />}
        />
        <MetricCard
          label="My approved expenses"
          value={
            <span className="font-mono">{formatCents(myApprovedExpensesThisMonth)}</span>
          }
          hint="This month"
          icon={<Receipt className="h-5 w-5" />}
        />
      </div>

      <div className={TWO_COL}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest payslip</CardTitle>
          </CardHeader>
          <CardContent>
            {latestPayslip ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Period
                  </div>
                  <div className="font-display text-2xl font-semibold tracking-tight font-mono">
                    {latestPayslip.month}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Net{" "}
                    <span className="font-mono text-foreground">
                      {formatCents(latestPayslip.netAmount, latestPayslip.currency)}
                    </span>
                  </div>
                </div>
                <Button asChild>
                  <Link to="/payroll">
                    <Download className="mr-2 h-4 w-4" /> Download
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No payslips yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-3xl font-semibold tracking-tight">
                  {myPendingExpenses}
                </div>
                <div className="text-sm text-muted-foreground">
                  {myPendingExpenses === 1 ? "expense" : "expenses"} awaiting
                  decision
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/expenses">View all</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            label="Nothing yet"
            hint="Your activity feed will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HRSection({ data }: { data: HrStats | undefined }) {
  if (!data) return <MetricSkeletonRow />;
  const {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    pendingExpensesCount,
    pendingExpensesAmount,
    attendanceTodayCount,
    departmentBreakdown,
  } = data;
  const maxCount = departmentBreakdown.reduce(
    (max, d) => Math.max(max, d.employeeCount),
    0,
  );
  return (
    <div className="space-y-6">
      <div className={METRIC_GRID}>
        <MetricCard
          label="Total employees"
          value={totalEmployees}
          icon={<Users className="h-5 w-5" />}
          accent
        />
        <MetricCard
          label="Active today"
          value={
            <span className="font-mono">
              {attendanceTodayCount} / {activeEmployees}
            </span>
          }
          hint="Clocked in today vs active roster"
          icon={<Clock className="h-5 w-5" />}
        />
        <MetricCard
          label="Pending expenses"
          value={pendingExpensesCount}
          hint={formatCents(pendingExpensesAmount)}
          icon={<Receipt className="h-5 w-5" />}
        />
        <MetricCard
          label="Inactive"
          value={inactiveEmployees}
          hint="Need offboarding?"
          icon={<UserPlus className="h-5 w-5" />}
        />
      </div>

      <div className={TWO_COL}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentBreakdown.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No departments yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {departmentBreakdown.map((d) => {
                  const pct =
                    maxCount > 0
                      ? Math.round((d.employeeCount / maxCount) * 100)
                      : 0;
                  return (
                    <li key={d.departmentId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{d.departmentName}</span>
                        </div>
                        <span className="font-mono text-muted-foreground">
                          {d.employeeCount}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-display text-3xl font-semibold tracking-tight">
                  {pendingExpensesCount}
                </div>
                <div className="text-sm text-muted-foreground">
                  awaiting decision —{" "}
                  <span className="font-mono">
                    {formatCents(pendingExpensesAmount)}
                  </span>
                </div>
              </div>
              <Button asChild>
                <Link to="/expenses">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Review queue
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminSection({ data }: { data: AdminStats | undefined }) {
  if (!data) return <MetricSkeletonRow />;
  const {
    totalEmployees,
    activeEmployees,
    departmentCount,
    openTasks,
    pendingExpenses,
    payrollMonth,
    totalPayrollNet,
    recentJoiners,
  } = data;
  return (
    <div className="space-y-6">
      <div className={METRIC_GRID}>
        <MetricCard
          label="Total employees"
          value={totalEmployees}
          hint={`${activeEmployees} active`}
          icon={<Users className="h-5 w-5" />}
          accent
        />
        <MetricCard
          label="Departments"
          value={departmentCount}
          icon={<Building2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Open tasks"
          value={openTasks}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <MetricCard
          label="Pending expenses"
          value={pendingExpenses}
          icon={<Receipt className="h-5 w-5" />}
        />
      </div>

      <div className={TWO_COL}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest payroll</CardTitle>
          </CardHeader>
          <CardContent>
            {payrollMonth ? (
              <div className="flex flex-col gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Most recent run
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-2xl font-semibold tracking-tight font-mono">
                    {payrollMonth}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  <span>
                    Total net{" "}
                    <span className="font-mono text-foreground">
                      {formatCents(totalPayrollNet)}
                    </span>
                  </span>
                </div>
                <div className="pt-2">
                  <Button variant="outline" asChild>
                    <Link to="/payroll">Open payroll</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No payroll runs yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent joiners</CardTitle>
          </CardHeader>
          <CardContent>
            {recentJoiners.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No recent hires recorded.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {recentJoiners.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{j.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {j.jobTitle ?? "No title"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      {formatRelative(j.hireDate)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const employee = useEmployeeStats();
  const hr = useHRStats();
  const admin = useAdminStats();

  if (role === "ADMIN") {
    return (
      <PageContainer width="wide" className="space-y-10">
        <PageHeader
          title="Admin overview"
          description="Company-wide metrics."
        />
        <AdminSection data={admin.data} />

        <div className="space-y-2 pt-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            HR overview
          </h2>
          <p className="text-sm text-muted-foreground">Pulse of the team.</p>
        </div>
        <HRSection data={hr.data} />

        <div className="space-y-2 pt-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            My day
          </h2>
          <p className="text-sm text-muted-foreground">
            A snapshot of your day at Global NeoChain.
          </p>
        </div>
        <EmployeeSection data={employee.data} />
      </PageContainer>
    );
  }

  if (role === "HR") {
    return (
      <PageContainer width="wide" className="space-y-10">
        <PageHeader title="HR overview" description="Pulse of the team." />
        <HRSection data={hr.data} />

        <div className="space-y-2 pt-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            My day
          </h2>
          <p className="text-sm text-muted-foreground">
            A snapshot of your day at Global NeoChain.
          </p>
        </div>
        <EmployeeSection data={employee.data} />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Today"
        description="A snapshot of your day at Global NeoChain."
      />
      <EmployeeSection data={employee.data} />
    </PageContainer>
  );
}
