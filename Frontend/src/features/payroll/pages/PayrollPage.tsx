import { useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  FileText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import { useAllPayslips, useMyPayslips, type Payslip } from "../api/hooks";
import { PayslipsTable } from "../components/PayslipsTable";
import { GeneratePayslipForm } from "../components/GeneratePayslipForm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatInr(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Last 12 months, newest first, as `YYYY-MM` keys for the picker. */
function lastTwelveMonths(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// KPI Tile (shared shape with Expenses/Calls/People for visual parity)
// ---------------------------------------------------------------------------

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warn";
}

const TONE_STYLES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "border-border/60",
  primary: "border-primary/40",
  success: "border-emerald-500/30",
  warn: "border-amber-500/30",
};

const TONE_ICON: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-emerald-400",
  warn: "text-amber-400",
};

function KpiTile({ label, value, hint, icon, tone = "default" }: KpiTileProps) {
  return (
    <div className={cn("rounded-xl border bg-card/40 p-4", TONE_STYLES[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {value}
          </div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40",
            TONE_ICON[tone],
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

interface PayslipStats {
  count: number;
  totalNet: number;
  latestMonth: string | null;
  latestNet: number;
}

function deriveStats(items: Payslip[]): PayslipStats {
  let totalNet = 0;
  let latestMonth: string | null = null;
  let latestNet = 0;
  for (const p of items) {
    totalNet += p.netAmount;
    if (!latestMonth || p.month > latestMonth) {
      latestMonth = p.month;
      latestNet = p.netAmount;
    }
  }
  return { count: items.length, totalNet, latestMonth, latestNet };
}

// ---------------------------------------------------------------------------
// Month picker — last 12 months as a clean dropdown
// ---------------------------------------------------------------------------

const ALL_MONTHS_VALUE = "__all__";

function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const months = lastTwelveMonths();
  const selectValue = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : ALL_MONTHS_VALUE;
  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === ALL_MONTHS_VALUE ? "" : v)}
    >
      <SelectTrigger className="h-9 w-[12rem] gap-2" aria-label="Filter by month">
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALL_MONTHS_VALUE}>All months</SelectItem>
        {months.map((m) => (
          <SelectItem key={m} value={m}>
            {formatMonthLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function MyPayslipsTab() {
  const [month, setMonth] = useState("");
  const params = useMemo(() => {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? { month, limit: 100 }
      : { limit: 100 };
  }, [month]);
  const q = useMyPayslips(params);
  const items = q.data?.items ?? [];
  const stats = useMemo(() => deriveStats(items), [items]);
  const loading = q.isLoading || !q.data;

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiTile
            label="Payslips on record"
            value={String(stats.count)}
            hint={month ? formatMonthLabel(month) : "All months"}
            icon={<FileText className="h-4 w-4" />}
            tone="primary"
          />
          <KpiTile
            label="Total net (filter)"
            value={formatInr(stats.totalNet)}
            hint="Sum of net pay across this view"
            icon={<TrendingUp className="h-4 w-4" />}
            tone="success"
          />
          <KpiTile
            label="Latest payslip"
            value={
              stats.latestMonth ? formatInr(stats.latestNet) : "—"
            }
            hint={stats.latestMonth ? formatMonthLabel(stats.latestMonth) : "No payslips yet"}
            icon={<Wallet className="h-4 w-4" />}
            tone="default"
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-base font-semibold tracking-tight text-foreground">
                My payslips
              </div>
              <div className="text-xs text-muted-foreground">
                Download monthly slips as PDFs.
              </div>
            </div>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                No payslips yet
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Once HR generates a payslip for you, it will appear here for
                download.
              </p>
            </div>
          ) : (
            <PayslipsTable
              payslips={items}
              emptyState="You don't have any payslips yet."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AllPayslipsTab() {
  const [month, setMonth] = useState("");
  const params = useMemo(() => {
    const p: Record<string, unknown> = { limit: 100 };
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) p.month = month;
    return p;
  }, [month]);
  const q = useAllPayslips(params);
  const items = q.data?.items ?? [];
  const stats = useMemo(() => deriveStats(items), [items]);
  const loading = q.isLoading || !q.data;
  const thisMonth = currentMonth();
  const thisMonthCount = useMemo(
    () => items.filter((p) => p.month === thisMonth).length,
    [items, thisMonth],
  );
  const thisMonthNet = useMemo(
    () =>
      items
        .filter((p) => p.month === thisMonth)
        .reduce((acc, p) => acc + p.netAmount, 0),
    [items, thisMonth],
  );

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Total payslips"
            value={String(stats.count)}
            hint={month ? formatMonthLabel(month) : "All months"}
            icon={<FileText className="h-4 w-4" />}
            tone="primary"
          />
          <KpiTile
            label="Net paid (filter)"
            value={formatInr(stats.totalNet)}
            hint="Sum of net across this view"
            icon={<TrendingUp className="h-4 w-4" />}
            tone="success"
          />
          <KpiTile
            label="This month"
            value={String(thisMonthCount)}
            hint={
              thisMonthCount > 0
                ? `${formatInr(thisMonthNet)} disbursed`
                : "No runs yet"
            }
            icon={<CalendarIcon className="h-4 w-4" />}
            tone={thisMonthCount > 0 ? "default" : "warn"}
          />
          <KpiTile
            label="Latest run"
            value={stats.latestMonth ? formatMonthLabel(stats.latestMonth) : "—"}
            hint={stats.latestMonth ? formatInr(stats.latestNet) + " · single payslip" : ""}
            icon={<Wallet className="h-4 w-4" />}
            tone="default"
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-base font-semibold tracking-tight text-foreground">
                All payslips
              </div>
              <div className="text-xs text-muted-foreground">
                Every payslip generated, across the team.
              </div>
            </div>
            <MonthPicker value={month} onChange={setMonth} />
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-foreground">
                No payslips on file
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Switch to the <span className="font-medium">Generate</span> tab to
                run a payslip for an employee.
              </p>
            </div>
          ) : (
            <PayslipsTable
              payslips={items}
              showOwner
              emptyState="No payslips match this filter."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PayrollPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isElevated = role === "HR" || role === "ADMIN";

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Finance · Payroll"
        title="Payroll"
        description="Generate and download monthly payslips."
      />

      {isElevated ? (
        <Tabs defaultValue="mine" className="space-y-5">
          <TabsList>
            <TabsTrigger value="mine">My payslips</TabsTrigger>
            <TabsTrigger value="all">All payslips</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="space-y-5">
            <MyPayslipsTab />
          </TabsContent>
          <TabsContent value="all" className="space-y-5">
            <AllPayslipsTab />
          </TabsContent>
          <TabsContent value="generate" className="space-y-5">
            <GeneratePayslipForm />
          </TabsContent>
        </Tabs>
      ) : (
        <MyPayslipsTab />
      )}
    </PageContainer>
  );
}
