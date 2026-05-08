import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  LineChart as LineChartIcon,
  ListChecks,
  Pencil,
  Receipt,
  RotateCcw,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { MetricCard } from "@/components/common/MetricCard";
import { EmptyState } from "@/components/common/EmptyState";
import { useAppSelector } from "@/app/hooks";
import { formatHoursMinutes as fmtHM, formatInrCents } from "@/lib/currency";
import { useNotifications } from "@/features/notifications/api/hooks";
import { MetricChart } from "../components/MetricChart";
import { PresentTodayCard } from "../components/PresentTodayCard";
import { WidgetGrid, type DashboardWidget } from "../components/WidgetGrid";
import {
  useAdminStats,
  useChartSeries,
  useEmployeeStats,
  useHRStats,
  type AdminStats,
  type ChartsResponse,
  type EmployeeStats,
  type Granularity,
  type HrStats,
  type SeriesPoint,
} from "../api/hooks";

/**
 * Format a paise/cents amount as a localized rupee string. Falls back to
 * the canonical Indian-locale `formatInrCents` so every amount across the
 * dashboard reads the same way regardless of the original cents source.
 *
 * The legacy `currency` argument is preserved for back-compat with the few
 * call sites that pass a stored payslip currency, but the value is ignored
 * — the platform standardised on INR.
 */
function formatCents(amount: number, _currency?: string): string {
  void _currency;
  return formatInrCents(amount);
}

function formatHoursMinutes(totalMinutes: number): string {
  // Local "always show both segments" formatter — distinct from the compact
  // shared util `fmtHM` used by the trend charts (which drops zero parts).
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

function MetricSkeleton() {
  return <Skeleton className="h-full w-full min-h-[6rem]" />;
}

// ─── Employee widgets ─────────────────────────────────────────────────────

function MetricTodayStatus({ data }: { data: EmployeeStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Today's status"
      value={<span className="text-xl">{describeAttendance(data.todayAttendance)}</span>}
      icon={<Clock className="h-5 w-5" />}
      accent
    />
  );
}

function MetricHoursThisMonth({ data }: { data: EmployeeStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Hours this month"
      value={<span className="font-mono">{formatHoursMinutes(data.monthHoursMinutes)}</span>}
      hint={`${data.monthDaysWorked} days worked`}
      icon={<Calendar className="h-5 w-5" />}
    />
  );
}

function MetricOpenTasks({ data }: { data: EmployeeStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Open tasks"
      value={data.myOpenTasks}
      hint="Across all projects"
      icon={<ListChecks className="h-5 w-5" />}
    />
  );
}

function MetricApprovedExpenses({ data }: { data: EmployeeStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="My approved expenses"
      value={<span className="font-mono">{formatCents(data.myApprovedExpensesThisMonth)}</span>}
      hint="This month"
      icon={<Receipt className="h-5 w-5" />}
    />
  );
}

function CardLatestPayslip({ data }: { data: EmployeeStats | undefined }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Latest payslip</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!data ? (
          <Skeleton className="h-20 w-full" />
        ) : data.latestPayslip ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Period
              </div>
              <div className="font-display text-2xl font-semibold tracking-tight font-mono">
                {data.latestPayslip.month}
              </div>
              <div className="text-sm text-muted-foreground">
                Net{" "}
                <span className="font-mono text-foreground">
                  {formatCents(data.latestPayslip.netAmount, data.latestPayslip.currency)}
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
  );
}

function CardPendingExpenses({ data }: { data: EmployeeStats | undefined }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Pending expenses</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!data ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-3xl font-semibold tracking-tight">
                {data.myPendingExpenses}
              </div>
              <div className="text-sm text-muted-foreground">
                {data.myPendingExpenses === 1 ? "expense" : "expenses"} awaiting
                decision
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link to="/expenses">View all</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * "Recent activity" surfaces the most recent notifications targeted at the
 * current user. The notifications service is the single source of truth for
 * every domain event (task assigned, expense approved, candidate verified,
 * call missed, etc.), so this is a thin presentation layer over it. A direct
 * link into the full notifications panel is provided for deeper history.
 */
function CardRecentActivity() {
  const list = useNotifications({ limit: 8 });
  const items = list.data?.items ?? [];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {list.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            label="Nothing yet"
            hint="Activity from across the workspace will appear here as it happens."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 py-2 text-sm"
              >
                <span
                  aria-hidden
                  className={
                    "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full " +
                    (n.readAt ? "bg-muted-foreground/40" : "bg-primary")
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <div
                      className={
                        "truncate " +
                        (n.readAt ? "text-foreground/80" : "font-semibold text-foreground")
                      }
                    >
                      {n.title}
                    </div>
                    <div className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {relativeFromIso(n.createdAt)}
                    </div>
                  </div>
                  {n.body && (
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {n.body}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function relativeFromIso(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

// ─── HR widgets ───────────────────────────────────────────────────────────

function MetricTotalEmployees({ data }: { data: HrStats | AdminStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  const active = "activeEmployees" in data ? data.activeEmployees : undefined;
  return (
    <MetricCard
      label="Total employees"
      value={data.totalEmployees}
      hint={typeof active === "number" ? `${active} active` : undefined}
      icon={<Users className="h-5 w-5" />}
      accent
    />
  );
}

function MetricActiveToday({ data }: { data: HrStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Active today"
      value={
        <span className="font-mono">
          {data.attendanceTodayCount} / {data.activeEmployees}
        </span>
      }
      hint="Clocked in today vs active roster"
      icon={<Clock className="h-5 w-5" />}
    />
  );
}

function MetricPendingExpensesHR({ data }: { data: HrStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Pending expenses"
      value={data.pendingExpensesCount}
      hint={formatCents(data.pendingExpensesAmount)}
      icon={<Receipt className="h-5 w-5" />}
    />
  );
}

function MetricInactive({ data }: { data: HrStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Inactive"
      value={data.inactiveEmployees}
      hint="Need offboarding?"
      icon={<UserPlus className="h-5 w-5" />}
    />
  );
}

function CardDeptBreakdown({ data }: { data: HrStats | undefined }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Department breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.departmentBreakdown.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No departments yet.
          </div>
        ) : (
          (() => {
            const maxCount = data.departmentBreakdown.reduce(
              (m, d) => Math.max(m, d.employeeCount),
              0,
            );
            return (
              <ul className="space-y-3">
                {data.departmentBreakdown.map((d) => {
                  const pct = maxCount > 0 ? Math.round((d.employeeCount / maxCount) * 100) : 0;
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
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

function CardPendingApprovals({ data }: { data: HrStats | undefined }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Pending approvals</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!data ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-display text-3xl font-semibold tracking-tight">
                {data.pendingExpensesCount}
              </div>
              <div className="text-sm text-muted-foreground">
                awaiting decision —{" "}
                <span className="font-mono">
                  {formatCents(data.pendingExpensesAmount)}
                </span>
              </div>
            </div>
            <Button asChild>
              <Link to="/expenses?tab=queue">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Review queue
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Admin widgets ────────────────────────────────────────────────────────

function MetricDepartments({ data }: { data: AdminStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Departments"
      value={data.departmentCount}
      icon={<Building2 className="h-5 w-5" />}
    />
  );
}

function MetricOpenTasksAdmin({ data }: { data: AdminStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Open tasks"
      value={data.openTasks}
      icon={<ListChecks className="h-5 w-5" />}
    />
  );
}

function MetricPendingExpensesAdmin({ data }: { data: AdminStats | undefined }) {
  if (!data) return <MetricSkeleton />;
  return (
    <MetricCard
      label="Pending expenses"
      value={data.pendingExpenses}
      icon={<Receipt className="h-5 w-5" />}
    />
  );
}

function CardLatestPayroll({ data }: { data: AdminStats | undefined }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Latest payroll</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!data ? (
          <Skeleton className="h-20 w-full" />
        ) : data.payrollMonth ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Most recent run
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-2xl font-semibold tracking-tight font-mono">
                {data.payrollMonth}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span>
                Total net{" "}
                <span className="font-mono text-foreground">
                  {formatCents(data.totalPayrollNet)}
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
  );
}

function CardRecentJoiners({ data }: { data: AdminStats | undefined }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Recent joiners</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {!data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.recentJoiners.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No recent hires recorded.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.recentJoiners.map((j) => (
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
  );
}

// ─── Trend widgets ────────────────────────────────────────────────────────

function sumSeries(points: SeriesPoint[] | undefined): number {
  if (!points) return 0;
  return points.reduce((acc, p) => acc + p.value, 0);
}

function isEmptySeries(points: SeriesPoint[] | undefined): boolean {
  if (!points || points.length === 0) return true;
  return points.every((p) => p.value === 0);
}

interface TrendCardProps {
  title: string;
  data: SeriesPoint[] | undefined;
  total: string;
  color: string;
  formatValue: (v: number) => string;
  loading: boolean;
}

function TrendCard({ title, data, total, color, formatValue, loading }: TrendCardProps) {
  return (
    <Card className="h-full border-border/60 bg-card/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </CardTitle>
            <div className="font-display text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {loading ? <Skeleton className="h-7 w-32" /> : total}
            </div>
          </div>
          <span
            aria-hidden
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
          />
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[200px] flex-1 flex-col pt-0">
        {loading ? (
          <Skeleton className="h-full min-h-[160px] w-full flex-1" />
        ) : isEmptySeries(data) ? (
          <div className="flex h-full min-h-[160px] flex-1 items-center justify-center rounded-md border border-dashed border-border/50 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            no data yet
          </div>
        ) : (
          <div className="flex-1 min-h-[160px]">
            <MetricChart data={data ?? []} color={color} formatValue={formatValue} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Trend tabs widget — granularity switch lifted out so it can be docked
 * into the grid as its own movable widget. Day/Month/Year toggle controls
 * what the three trend tiles below ask the API for, via shared state held
 * in DashboardPage.
 */
function CardTrendsHeader({
  granularity,
  onChange,
}: {
  granularity: Granularity;
  onChange: (g: Granularity) => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex h-full flex-col justify-center gap-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LineChartIcon className="h-4 w-4 text-muted-foreground" />
          <span>Trends</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Working hours, expenses, and payroll over time.
        </p>
        <Tabs value={granularity} onValueChange={(v) => onChange(v as Granularity)}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="day" className="h-7 flex-1 text-xs">
              Daily
            </TabsTrigger>
            <TabsTrigger value="month" className="h-7 flex-1 text-xs">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="year" className="h-7 flex-1 text-xs">
              Yearly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

interface WidgetCtx {
  employee: EmployeeStats | undefined;
  hr: HrStats | undefined;
  admin: AdminStats | undefined;
  charts: ChartsResponse | undefined;
  chartsLoading: boolean;
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;
}

/**
 * Build the per-role widget set. Each widget is independently draggable
 * and resizable in WidgetGrid; the `defaultLayout` here is what users see
 * the first time they visit, and the moment they drag/resize anything it
 * gets persisted per-role in localStorage.
 *
 * Coordinates use react-grid-layout's `lg`-breakpoint 12-column grid; the
 * smaller breakpoints (md/sm/xs/xxs) are derived in WidgetGrid so we don't
 * have to maintain four separate layouts by hand.
 */
function buildWidgets(role: string | undefined, ctx: WidgetCtx): DashboardWidget[] {
  const trendWorkingHours: DashboardWidget = {
    id: "trend.workingHours",
    label: "Working hours",
    defaultLayout: { x: 0, y: 12, w: 4, h: 5, minW: 3, minH: 4 },
    render: () => (
      <TrendCard
        title="Working hours"
        data={ctx.charts?.attendance}
        total={fmtHM(sumSeries(ctx.charts?.attendance))}
        color="hsl(195 90% 55%)"
        formatValue={(v) => fmtHM(v)}
        loading={ctx.chartsLoading}
      />
    ),
  };
  const trendExpenses: DashboardWidget = {
    id: "trend.approvedExpenses",
    label: "Approved expenses",
    defaultLayout: { x: 4, y: 12, w: 4, h: 5, minW: 3, minH: 4 },
    render: () => (
      <TrendCard
        title="Approved expenses"
        data={ctx.charts?.expenses}
        total={formatInrCents(sumSeries(ctx.charts?.expenses))}
        color="hsl(38 92% 55%)"
        formatValue={(v) => formatInrCents(v)}
        loading={ctx.chartsLoading}
      />
    ),
  };
  const trendPayroll: DashboardWidget = {
    id: "trend.payroll",
    label: "Payroll trend",
    defaultLayout: { x: 8, y: 12, w: 4, h: 5, minW: 3, minH: 4 },
    render: () => (
      <TrendCard
        title="Payroll"
        data={ctx.charts?.payroll}
        total={formatInrCents(sumSeries(ctx.charts?.payroll))}
        color="hsl(160 70% 45%)"
        formatValue={(v) => formatInrCents(v)}
        loading={ctx.chartsLoading}
      />
    ),
  };
  const trendsHeader: DashboardWidget = {
    id: "trend.header",
    label: "Trends header",
    defaultLayout: { x: 0, y: 11, w: 12, h: 2, minW: 4, minH: 2 },
    render: () => (
      <CardTrendsHeader
        granularity={ctx.granularity}
        onChange={ctx.setGranularity}
      />
    ),
  };
  const presence: DashboardWidget = {
    id: "presence.today",
    label: "Present today",
    defaultLayout: { x: 0, y: 6, w: 12, h: 5, minW: 4, minH: 4 },
    render: () => <PresentTodayCard />,
  };

  if (role === "ADMIN") {
    return [
      {
        id: "metric.admin.totalEmployees",
        label: "Total employees",
        defaultLayout: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricTotalEmployees data={ctx.admin} />,
      },
      {
        id: "metric.admin.departments",
        label: "Departments",
        defaultLayout: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricDepartments data={ctx.admin} />,
      },
      {
        id: "metric.admin.openTasks",
        label: "Open tasks",
        defaultLayout: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricOpenTasksAdmin data={ctx.admin} />,
      },
      {
        id: "metric.admin.pendingExpenses",
        label: "Pending expenses",
        defaultLayout: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricPendingExpensesAdmin data={ctx.admin} />,
      },
      {
        id: "card.admin.latestPayroll",
        label: "Latest payroll",
        defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        render: () => <CardLatestPayroll data={ctx.admin} />,
      },
      {
        id: "card.admin.recentJoiners",
        label: "Recent joiners",
        defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        render: () => <CardRecentJoiners data={ctx.admin} />,
      },
      presence,
      trendsHeader,
      trendWorkingHours,
      trendExpenses,
      trendPayroll,
      {
        id: "card.recentActivity",
        label: "Recent activity",
        defaultLayout: { x: 0, y: 17, w: 12, h: 6, minW: 4, minH: 4 },
        render: () => <CardRecentActivity />,
      },
    ];
  }

  if (role === "HR") {
    return [
      {
        id: "metric.hr.totalEmployees",
        label: "Total employees",
        defaultLayout: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricTotalEmployees data={ctx.hr} />,
      },
      {
        id: "metric.hr.activeToday",
        label: "Active today",
        defaultLayout: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricActiveToday data={ctx.hr} />,
      },
      {
        id: "metric.hr.pendingExpenses",
        label: "Pending expenses",
        defaultLayout: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricPendingExpensesHR data={ctx.hr} />,
      },
      {
        id: "metric.hr.inactive",
        label: "Inactive",
        defaultLayout: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
        render: () => <MetricInactive data={ctx.hr} />,
      },
      {
        id: "card.hr.deptBreakdown",
        label: "Department breakdown",
        defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        render: () => <CardDeptBreakdown data={ctx.hr} />,
      },
      {
        id: "card.hr.pendingApprovals",
        label: "Pending approvals",
        defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        render: () => <CardPendingApprovals data={ctx.hr} />,
      },
      presence,
      trendsHeader,
      trendWorkingHours,
      trendExpenses,
      trendPayroll,
    ];
  }

  // Employee (default)
  return [
    {
      id: "metric.emp.todayStatus",
      label: "Today's status",
      defaultLayout: { x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      render: () => <MetricTodayStatus data={ctx.employee} />,
    },
    {
      id: "metric.emp.hours",
      label: "Hours this month",
      defaultLayout: { x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      render: () => <MetricHoursThisMonth data={ctx.employee} />,
    },
    {
      id: "metric.emp.openTasks",
      label: "Open tasks",
      defaultLayout: { x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      render: () => <MetricOpenTasks data={ctx.employee} />,
    },
    {
      id: "metric.emp.approvedExpenses",
      label: "Approved expenses",
      defaultLayout: { x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
      render: () => <MetricApprovedExpenses data={ctx.employee} />,
    },
    {
      id: "card.emp.latestPayslip",
      label: "Latest payslip",
      defaultLayout: { x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
      render: () => <CardLatestPayslip data={ctx.employee} />,
    },
    {
      id: "card.emp.pendingExpenses",
      label: "Pending expenses",
      defaultLayout: { x: 6, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
      render: () => <CardPendingExpenses data={ctx.employee} />,
    },
    presence,
    trendsHeader,
    trendWorkingHours,
    trendExpenses,
    {
      id: "card.recentActivity",
      label: "Recent activity",
      defaultLayout: { x: 0, y: 17, w: 12, h: 6, minW: 4, minH: 4 },
      render: () => <CardRecentActivity />,
    },
  ];
}

export function DashboardPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const employee = useEmployeeStats();
  const hr = useHRStats();
  const admin = useAdminStats();
  const [granularity, setGranularity] = useState<Granularity>("month");
  const charts = useChartSeries(granularity);
  // Per-role customization toggle. Each role gets its own localStorage key
  // so the same browser session can host an Admin's preferred layout and
  // an Employee's preferred layout side-by-side.
  const [customizing, setCustomizing] = useState(false);
  const [remount, setRemount] = useState(0);

  const ctx: WidgetCtx = useMemo(
    () => ({
      employee: employee.data,
      hr: hr.data,
      admin: admin.data,
      charts: charts.data,
      chartsLoading: charts.isLoading,
      granularity,
      setGranularity,
    }),
    [employee.data, hr.data, admin.data, charts.data, charts.isLoading, granularity],
  );

  const widgets = useMemo(() => buildWidgets(role, ctx), [role, ctx]);

  const headerCopy = useMemo<{
    eyebrow: string;
    title: string;
    description: string;
  }>(() => {
    if (role === "ADMIN") {
      return {
        eyebrow: "Dashboard · Admin",
        title: "Company overview",
        description:
          "The pulse of Global NeoChain — headcount, trends, and approvals at a glance.",
      };
    }
    if (role === "HR") {
      return {
        eyebrow: "Dashboard · HR",
        title: "HR overview",
        description:
          "Workforce pulse — headcount, attendance, and pending approvals.",
      };
    }
    return {
      eyebrow: "Dashboard",
      title: "Today",
      description: "A snapshot of your day at Global NeoChain.",
    };
  }, [role]);

  const storageKey = `dashboard.widgets.v2.${role ?? "DEFAULT"}`;

  // `hasCustomLayout` drives whether the Reset button is shown. We poll
  // localStorage on focus + a cheap 1s interval inside customize mode so
  // the button appears the moment the user moves their first widget. The
  // remount counter forces a re-read after a successful reset.
  const [hasCustomLayout, setHasCustomLayout] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    function check() {
      try {
        setHasCustomLayout(localStorage.getItem(storageKey) !== null);
      } catch {
        setHasCustomLayout(false);
      }
    }
    check();
    // While the user is editing, layouts can be saved on every drag/resize
    // tick. Poll lightly so the Reset button surfaces without a manual
    // refresh; outside customize mode the saved value rarely changes.
    const id = window.setInterval(check, customizing ? 750 : 5000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [storageKey, customizing, remount]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  function resetLayout() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore — private browsing
    }
    setHasCustomLayout(false);
    setRemount((r) => r + 1);
    toast.success("Dashboard reset to defaults");
  }

  return (
    <PageContainer width="wide" className="space-y-8">
      <PageHeader
        eyebrow={headerCopy.eyebrow}
        title={headerCopy.title}
        description={headerCopy.description}
        actions={
          <div className="flex items-center gap-2">
            {hasCustomLayout && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => setConfirmOpen(true)}
                title="Restore the default layout"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              variant={customizing ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setCustomizing((v) => !v)}
            >
              {customizing ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Customize
                </>
              )}
            </Button>
          </div>
        }
      />
      {customizing && (
        <div className="rounded-md border border-primary/30 bg-primary/[0.04] px-4 py-2.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Customize mode:</span>{" "}
          drag the handle on a widget to move it, drag the bottom-right corner
          to resize. Your layout saves automatically.
        </div>
      )}
      <WidgetGrid
        key={remount}
        widgets={widgets}
        storageKey={storageKey}
        editing={customizing}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset dashboard layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This restores the default arrangement and sizes for every
              widget. Your saved positions for the{" "}
              <span className="font-medium text-foreground">
                {role?.toLowerCase() ?? "default"}
              </span>{" "}
              dashboard will be discarded. This can't be undone — but you can
              always rearrange again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetLayout();
                setConfirmOpen(false);
              }}
            >
              Reset to default
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
