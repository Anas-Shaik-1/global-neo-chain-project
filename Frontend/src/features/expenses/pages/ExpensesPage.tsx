import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock3,
  Download,
  Plus,
  Upload,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import {
  useAllExpenses,
  useMyExpenses,
  type Expense,
  type ExpenseStatus,
} from "../api/hooks";
import { ExpensesTable } from "../components/ExpensesTable";
import { SubmitExpenseDialog } from "../components/SubmitExpenseDialog";
import { ExpenseDecideDialog } from "../components/ExpenseDecideDialog";
import { ImportExpensesDialog } from "../components/ImportExpensesDialog";
import { downloadCSV, toCSV } from "@/lib/csv";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StatusFilter = ExpenseStatus | "ALL";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function filterBySearch(items: Expense[], term: string): Expense[] {
  const t = term.trim().toLowerCase();
  if (!t) return items;
  return items.filter((e) =>
    [e.description, e.category, e.userName ?? ""].some((field) =>
      field.toLowerCase().includes(t),
    ),
  );
}

function formatInr(cents: number): string {
  const rupees = cents / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Convert in-memory expenses to a CSV string the import dialog can round-trip.
 * Header row matches what the importer expects so an export → edit-in-Excel
 * → import workflow works without column-renaming.
 *
 * Amount is exported in major units (rupees, two decimals) for human-friendly
 * editing; the importer multiplies by 100 to recover paise.
 */
function expensesToCSV(items: Expense[]): string {
  const header: (string | number)[] = [
    "date",
    "category",
    "description",
    "amount",
    "currency",
    "status",
    "submitter",
    "amount_inr",
    "decided_by",
    "decided_at",
  ];
  const rows: (string | number)[][] = [header];
  for (const e of items) {
    const date = new Date(e.incurredOn);
    const dateStr = isNaN(date.getTime())
      ? e.incurredOn
      : date.toISOString().slice(0, 10); // YYYY-MM-DD
    rows.push([
      dateStr,
      e.category,
      e.description,
      (e.amount / 100).toFixed(2),
      e.currency,
      e.status,
      e.userName ?? "",
      (e.amountInr / 100).toFixed(2),
      e.decisionByName ?? "",
      e.decidedAt ?? "",
    ]);
  }
  return toCSV(rows);
}

interface DerivedStats {
  total: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvedInrCents: number;
  pendingInrCents: number;
}

function deriveStats(items: Expense[]): DerivedStats {
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let approvedInrCents = 0;
  let pendingInrCents = 0;
  for (const e of items) {
    if (e.status === "PENDING") {
      pendingCount += 1;
      pendingInrCents += e.amountInr;
    } else if (e.status === "APPROVED") {
      approvedCount += 1;
      approvedInrCents += e.amountInr;
    } else if (e.status === "REJECTED") {
      rejectedCount += 1;
    }
  }
  return {
    total: items.length,
    pendingCount,
    approvedCount,
    rejectedCount,
    approvedInrCents,
    pendingInrCents,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success" | "danger" | "warn";
}

const TONE_STYLES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "border-border/60",
  primary: "border-primary/40",
  success: "border-emerald-500/30",
  warn: "border-amber-500/30",
  danger: "border-red-500/30",
};

const TONE_ICON: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-red-400",
};

function KpiTile({ label, value, hint, icon, tone = "default" }: KpiTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card/40 p-4 transition-colors",
        TONE_STYLES[tone],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
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

function KpiStrip({ stats, loading }: { stats: DerivedStats; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile
        label="Total submitted"
        value={String(stats.total)}
        hint={`${stats.pendingCount + stats.approvedCount + stats.rejectedCount} on record`}
        icon={<Receipt className="h-4 w-4" />}
        tone="primary"
      />
      <KpiTile
        label="Pending"
        value={String(stats.pendingCount)}
        hint={
          stats.pendingInrCents > 0 ? formatInr(stats.pendingInrCents) : "Nothing awaiting"
        }
        icon={<Clock3 className="h-4 w-4" />}
        tone="warn"
      />
      <KpiTile
        label="Approved (INR)"
        value={formatInr(stats.approvedInrCents)}
        hint={`${stats.approvedCount} ${stats.approvedCount === 1 ? "expense" : "expenses"}`}
        icon={<CheckCircle2 className="h-4 w-4" />}
        tone="success"
      />
      <KpiTile
        label="Rejected"
        value={String(stats.rejectedCount)}
        hint={stats.rejectedCount === 0 ? "All clear" : "Review feedback"}
        icon={<XCircle className="h-4 w-4" />}
        tone={stats.rejectedCount > 0 ? "danger" : "default"}
      />
    </div>
  );
}

function FilterPills({
  value,
  onChange,
  counts,
}: {
  value: StatusFilter;
  onChange: (next: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter expenses by status"
      className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-card/40 p-1"
    >
      {STATUS_FILTERS.map((opt) => {
        const active = opt.value === value;
        const count = counts[opt.value] ?? 0;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                active ? "bg-black/15" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Toolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  counts,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  status: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="lg:max-w-md lg:flex-1">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          ariaLabel="Search expenses"
        />
      </div>
      <FilterPills value={status} onChange={onStatusChange} counts={counts} />
    </div>
  );
}

function TotalFooter({ totalInrCents }: { totalInrCents: number }) {
  return (
    <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        sum of approved + pending · INR equivalent
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-mono text-base font-semibold tabular-nums text-foreground">
          {formatInr(totalInrCents)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function MyExpensesTab() {
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  // We always fetch the full set so the KPI strip + filter counts reflect
  // *everything*, not just the filtered slice. Filtering happens client-side.
  const q = useMyExpenses({ limit: 100 });
  // Salaries live in a dedicated tab; the reimbursements view filters them
  // out so the totals reflect only the user-submittable categories.
  const items = (q.data?.items ?? []).filter((e) => e.category !== "SALARY");
  const stats = useMemo(() => deriveStats(items), [items]);
  const counts: Record<StatusFilter, number> = {
    ALL: stats.total,
    PENDING: stats.pendingCount,
    APPROVED: stats.approvedCount,
    REJECTED: stats.rejectedCount,
  };
  const filtered = useMemo(() => {
    const byStatus =
      status === "ALL" ? items : items.filter((e) => e.status === status);
    return filterBySearch(byStatus, search);
  }, [items, status, search]);
  const totalInrCents = q.data?.summary?.totalInrCents ?? 0;
  const paginated = usePagination(filtered, 10);

  return (
    <div className="space-y-5">
      <KpiStrip stats={stats} loading={q.isLoading || !q.data} />
      <Card>
        <CardContent className="space-y-5 pt-5">
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by description or category…"
            status={status}
            onStatusChange={setStatus}
            counts={counts}
          />
          {q.isLoading || !q.data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <ExpensesTable
                expenses={paginated.items}
                showActions={false}
                emptyState={
                  search || status !== "ALL"
                    ? "No expenses match your filters."
                    : "You haven't submitted any expenses yet. Click + Submit expense to get started."
                }
              />
              <Pagination
                page={paginated.page}
                pageSize={paginated.pageSize}
                totalPages={paginated.totalPages}
                totalItems={paginated.totalItems}
                onPageChange={paginated.setPage}
                onPageSizeChange={paginated.setPageSize}
              />
              {items.length > 0 && <TotalFooter totalInrCents={totalInrCents} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalQueueTab({
  onApprove,
  onReject,
}: {
  onApprove: (e: Expense) => void;
  onReject: (e: Expense) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [search, setSearch] = useState("");
  const q = useAllExpenses({ limit: 100 });
  // Salaries live in a dedicated tab; never show in the approval queue.
  const items = (q.data?.items ?? []).filter((e) => e.category !== "SALARY");
  const stats = useMemo(() => deriveStats(items), [items]);
  const counts: Record<StatusFilter, number> = {
    ALL: stats.total,
    PENDING: stats.pendingCount,
    APPROVED: stats.approvedCount,
    REJECTED: stats.rejectedCount,
  };
  const filtered = useMemo(() => {
    const byStatus =
      status === "ALL" ? items : items.filter((e) => e.status === status);
    return filterBySearch(byStatus, search);
  }, [items, status, search]);
  const totalInrCents = q.data?.summary?.totalInrCents ?? 0;
  const paginated = usePagination(filtered, 10);

  return (
    <div className="space-y-5">
      <KpiStrip stats={stats} loading={q.isLoading || !q.data} />
      <Card>
        <CardContent className="space-y-5 pt-5">
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by description, category, or submitter…"
            status={status}
            onStatusChange={setStatus}
            counts={counts}
          />
          {q.isLoading || !q.data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <ExpensesTable
                expenses={paginated.items}
                showOwner
                showActions
                onApprove={onApprove}
                onReject={onReject}
                emptyState={
                  status === "PENDING"
                    ? "No expenses awaiting your decision. 🎉"
                    : "No expenses match this filter."
                }
              />
              <Pagination
                page={paginated.page}
                pageSize={paginated.pageSize}
                totalPages={paginated.totalPages}
                totalItems={paginated.totalItems}
                onPageChange={paginated.setPage}
                onPageSizeChange={paginated.setPageSize}
              />
              {items.length > 0 && <TotalFooter totalInrCents={totalInrCents} />}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Dedicated view for the SALARY-category expenses auto-created by payroll.
 * Kept separate from reimbursements so the spend report stays meaningful —
 * mixing employee submissions with the monthly payroll line items would
 * drown the queue and skew totals. Admin-only.
 */
function SalariesTab() {
  const [search, setSearch] = useState("");
  const q = useAllExpenses({ limit: 100 });
  const all = q.data?.items ?? [];
  const items = useMemo(
    () => all.filter((e) => e.category === "SALARY"),
    [all],
  );

  const totalInrCents = useMemo(
    () => items.reduce((s, e) => s + e.amountInr, 0),
    [items],
  );
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter((e) =>
      [e.description, e.userName ?? ""].some((f) =>
        f.toLowerCase().includes(t),
      ),
    );
  }, [items, search]);
  const paginated = usePagination(filtered, 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          label="Total payslips"
          value={String(items.length)}
          icon={<Receipt className="h-4 w-4" />}
          tone="primary"
        />
        <KpiTile
          label="Total paid (INR)"
          value={formatInr(totalInrCents)}
          icon={<Wallet className="h-4 w-4" />}
          tone="success"
        />
        <KpiTile
          label="Distinct employees"
          value={String(new Set(items.map((e) => e.userId)).size)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="default"
        />
      </div>
      <Card>
        <CardContent className="space-y-5 pt-5">
          <div className="lg:max-w-md lg:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by description or employee…"
              ariaLabel="Search salaries"
            />
          </div>
          {q.isLoading || !q.data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <ExpensesTable
                expenses={paginated.items}
                showOwner
                showActions={false}
                emptyState="No salary entries yet. Generate a payslip from the Payroll page to see one here."
              />
              <Pagination
                page={paginated.page}
                pageSize={paginated.pageSize}
                totalPages={paginated.totalPages}
                totalItems={paginated.totalItems}
                onPageChange={paginated.setPage}
                onPageSizeChange={paginated.setPageSize}
              />
              {items.length > 0 && (
                <TotalFooter totalInrCents={totalInrCents} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Submit-only surface shown to every non-admin role. Replaces the previous
 * "My expenses" listing — employees should be able to file a reimbursement
 * without seeing prior submissions, totals, or anyone else's data. The
 * full tabbed view (My expenses + approval queue + salaries) is reserved
 * for admins because they're the ones who actually decide expenses.
 *
 * Note this is purely a presentation-layer hide: the `useMyExpenses` API
 * still exists and any dashboard widget that surfaces user stats (e.g.
 * pending count) keeps working untouched.
 */
function EmployeeSubmitView({
  onSubmit,
}: {
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center sm:py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div className="space-y-1.5">
          <div className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Submit a reimbursement
          </div>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            File an expense for a work-related purchase. An admin will
            review your submission — you'll get a notification when it's
            approved or rejected.
          </p>
        </div>
        <Button onClick={onSubmit} size="lg" className="mt-2 gap-2">
          <Plus className="h-4 w-4" />
          Submit expense
        </Button>
        <p className="mt-4 max-w-sm text-xs text-muted-foreground">
          Need help? Attach a receipt, pick a category, and add a short
          description. You'll see the decision land in your notifications.
        </p>
      </CardContent>
    </Card>
  );
}

export function ExpensesPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  // Approvals are admin-only. HR can no longer decide expenses; the approval
  // queue tab is hidden for non-admins (the API would also 403 the request).
  const isAdmin = role === "ADMIN";

  // Tab selection is URL-driven so deep links from elsewhere in the app
  // (e.g. dashboard's "Review queue" CTA) can land directly on the approval
  // queue. `?tab=queue` → approval queue; `?tab=salaries` → salaries (admin
  // only); default → my expenses.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  let tab: "mine" | "all" | "salaries" = "mine";
  if (isAdmin && rawTab === "queue") tab = "all";
  else if (isAdmin && rawTab === "salaries") tab = "salaries";
  function setTab(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.set("tab", "queue");
    else if (next === "salaries") params.set("tab", "salaries");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
  }

  const [showSubmit, setShowSubmit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [decideTarget, setDecideTarget] = useState<Expense | null>(null);
  const [decideKind, setDecideKind] = useState<"APPROVED" | "REJECTED" | null>(
    null,
  );

  // Same hooks the tabs use — TanStack cache de-dupes so this is free.
  // We need them at the page level so the Export button can read the
  // currently-displayed dataset regardless of which tab is active.
  const myExport = useMyExpenses({ limit: 100 });
  const allExport = useAllExpenses({ limit: 100 });
  const exportItems =
    tab === "all" && isAdmin
      ? allExport.data?.items ?? []
      : myExport.data?.items ?? [];

  function onExport() {
    if (exportItems.length === 0) return;
    const csv = expensesToCSV(exportItems);
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = tab === "all" && isAdmin ? "all" : "mine";
    downloadCSV(`expenses-${scope}-${stamp}.csv`, csv);
  }

  function openDecide(e: Expense, kind: "APPROVED" | "REJECTED") {
    setDecideTarget(e);
    setDecideKind(kind);
  }
  function closeDecide() {
    setDecideTarget(null);
    setDecideKind(null);
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Finance · Expenses"
        title={isAdmin ? "Expenses" : "Submit an expense"}
        description={
          isAdmin
            ? "Submit reimbursements and approve team requests."
            : "File a reimbursement for a work-related purchase. An admin will review it."
        }
        actions={
          // Non-admins only get the primary submit CTA; export/import/admin
          // tooling stays hidden so the page surface matches the trimmed view.
          isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={onExport}
                disabled={exportItems.length === 0}
                title={
                  exportItems.length === 0
                    ? "No data to export"
                    : "Download as CSV (Excel-compatible)"
                }
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowImport(true)}
                title="Import expenses from a CSV file"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button onClick={() => setShowSubmit(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Submit expense
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowSubmit(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Submit expense
            </Button>
          )
        }
      />

      {isAdmin ? (
        <Tabs value={tab} onValueChange={setTab} className="space-y-5">
          <TabsList>
            <TabsTrigger value="mine">My expenses</TabsTrigger>
            <TabsTrigger value="all">Approval queue</TabsTrigger>
            <TabsTrigger value="salaries">Salaries</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="space-y-5">
            <MyExpensesTab />
          </TabsContent>
          <TabsContent value="all" className="space-y-5">
            <ApprovalQueueTab
              onApprove={(e) => openDecide(e, "APPROVED")}
              onReject={(e) => openDecide(e, "REJECTED")}
            />
          </TabsContent>
          <TabsContent value="salaries" className="space-y-5">
            <SalariesTab />
          </TabsContent>
        </Tabs>
      ) : (
        <EmployeeSubmitView onSubmit={() => setShowSubmit(true)} />
      )}

      <SubmitExpenseDialog open={showSubmit} onOpenChange={setShowSubmit} />
      <ImportExpensesDialog open={showImport} onOpenChange={setShowImport} />

      <ExpenseDecideDialog
        open={!!decideTarget && !!decideKind}
        onOpenChange={(o) => {
          if (!o) closeDecide();
        }}
        expense={decideTarget}
        decision={decideKind}
      />
    </PageContainer>
  );
}
