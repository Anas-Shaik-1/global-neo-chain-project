import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, PieChart as PieChartIcon, BarChart3 } from "lucide-react";
import type { Expense } from "../api/hooks";

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatInrCompact(cents: number): string {
  // Compact INR formatter for axes / tooltips (k / L / Cr).
  const r = cents / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(1)}Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(1)}L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(1)}k`;
  return `₹${r.toFixed(0)}`;
}

function formatInrFull(cents: number): string {
  const r = cents / 100;
  return `₹${r.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthBucket(iso: string): string {
  // YYYY-MM — used both as the group key and as the X-axis label.
  if (!iso) return "—";
  return iso.slice(0, 7);
}

function monthLabel(bucket: string): string {
  // "2026-03" → "Mar 26"
  const [y, m] = bucket.split("-");
  if (!y || !m) return bucket;
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Brand-matched palette (cyan → violet → emerald → amber → rose) so the
// charts feel like the rest of the app rather than recharts' grey defaults.
const PALETTE = [
  "hsl(195 90% 55%)",
  "hsl(258 75% 60%)",
  "hsl(150 70% 45%)",
  "hsl(40 90% 55%)",
  "hsl(330 75% 60%)",
  "hsl(220 80% 60%)",
  "hsl(15 80% 60%)",
  "hsl(285 70% 60%)",
];

const STATUS_TONE: Record<string, string> = {
  PENDING: "hsl(40 90% 55%)",
  APPROVED: "hsl(150 70% 45%)",
  REJECTED: "hsl(0 70% 55%)",
};

// ─── Monthly trend chart ──────────────────────────────────────────────────

function MonthlyTrendChart({ items }: { items: Expense[] }) {
  // Build the last 6 month buckets (anchored to the current month) so even
  // sparse data renders as a real timeline rather than a single dot.
  const data = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(k, 0);
    }
    for (const e of items) {
      // Only count realised + pending spend (rejected isn't real outflow).
      if (e.status === "REJECTED") continue;
      const bucket = monthBucket(e.incurredOn);
      if (buckets.has(bucket)) {
        buckets.set(bucket, (buckets.get(bucket) ?? 0) + e.amountInr);
      }
    }
    return Array.from(buckets.entries()).map(([bucket, value]) => ({
      bucket,
      label: monthLabel(bucket),
      value,
    }));
  }, [items]);

  // useId() emits stable, render-safe strings like `:r1:`; the colons are
  // valid in SVG IDs but `url(#…)` references look cleaner without them.
  const rawId = useId();
  const gradientId = `expense-trend-${rawId.replace(/:/g, "")}`;
  const empty = data.every((d) => d.value === 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Monthly trend
          </CardTitle>
          <p className="mt-1 text-sm font-display font-semibold tracking-tight text-foreground">
            Spend over the last 6 months
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-primary">
          <CalendarDays className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-64">
          {empty ? (
            <EmptyState label="No spend in the last 6 months yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={PALETTE[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border) / 0.3)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  stroke="hsl(var(--border))"
                  tickLine={false}
                  tickFormatter={formatInrCompact}
                  width={64}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(v) =>
                    [
                      formatInrFull(typeof v === "number" ? v : Number(v) || 0),
                      "",
                    ] as [string, string]
                  }
                  separator=""
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={PALETTE[0]}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grouped amount chart (category / user) ───────────────────────────────

function GroupedAmountChart({
  items,
  groupBy,
}: {
  items: Expense[];
  groupBy: "category" | "user";
}) {
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of items) {
      if (e.status === "REJECTED") continue;
      const key =
        groupBy === "category"
          ? e.category
          : e.userName ?? "Unknown";
      totals.set(key, (totals.get(key) ?? 0) + e.amountInr);
    }
    return Array.from(totals.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [items, groupBy]);

  const empty = data.length === 0;
  const title = groupBy === "category" ? "By category" : "By employee";
  const subtitle =
    groupBy === "category"
      ? "Approved + pending spend, INR"
      : "Top 8 by total payout, INR";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </CardTitle>
          <p className="mt-1 text-sm font-display font-semibold tracking-tight text-foreground">
            {subtitle}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-primary">
          <BarChart3 className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-64">
          {empty ? (
            <EmptyState label="No data to chart yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border) / 0.3)"
                />
                <XAxis
                  type="number"
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  stroke="hsl(var(--border))"
                  tickLine={false}
                  tickFormatter={formatInrCompact}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--foreground))",
                  }}
                  stroke="hsl(var(--border))"
                  tickLine={false}
                  width={groupBy === "category" ? 80 : 110}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(v) =>
                    [
                      formatInrFull(typeof v === "number" ? v : Number(v) || 0),
                      "",
                    ] as [string, string]
                  }
                  separator=""
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Status breakdown donut ───────────────────────────────────────────────

function StatusBreakdownChart({ items }: { items: Expense[] }) {
  const data = useMemo(() => {
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const e of items) {
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    }
    return (Object.entries(counts) as [keyof typeof counts, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k, value: v }));
  }, [items]);

  const empty = data.length === 0;
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Status mix
          </CardTitle>
          <p className="mt-1 text-sm font-display font-semibold tracking-tight text-foreground">
            Where things stand
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/40 text-primary">
          <PieChartIcon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative h-64">
          {empty ? (
            <EmptyState label="No expenses to break down yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {data.map((d) => (
                      <Cell
                        key={d.name}
                        fill={STATUS_TONE[d.name] ?? "hsl(var(--muted-foreground))"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                    }}
                    formatter={(v, name) => {
                      const n = typeof v === "number" ? v : Number(v) || 0;
                      return [
                        `${n} · ${((n / total) * 100).toFixed(0)}%`,
                        String(name),
                      ];
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: 11,
                      color: "hsl(var(--muted-foreground))",
                      paddingTop: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label — total expense count, drawn over the donut */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
                <div className="font-display text-2xl font-semibold tabular-nums text-foreground">
                  {total}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  expenses
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <p className="max-w-xs text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────

export interface ExpenseChartsProps {
  items: Expense[];
  /** Switches the second chart between category breakdown (reimbursements)
   *  and per-employee breakdown (salaries). */
  groupBy?: "category" | "user";
  /** Salaries don't go through PENDING/REJECTED — hide the donut for them. */
  showStatus?: boolean;
}

export function ExpenseCharts({
  items,
  groupBy = "category",
  showStatus = true,
}: ExpenseChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MonthlyTrendChart items={items} />
      <GroupedAmountChart items={items} groupBy={groupBy} />
      {showStatus && (
        <div className="lg:col-span-2">
          <StatusBreakdownChart items={items} />
        </div>
      )}
    </div>
  );
}
