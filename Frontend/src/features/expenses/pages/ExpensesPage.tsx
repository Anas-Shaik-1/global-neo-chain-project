import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { SearchBar } from "@/components/common/SearchBar";
import { useAppSelector } from "@/app/hooks";
import {
  EXPENSE_STATUSES,
  useAllExpenses,
  useMyExpenses,
  type Expense,
  type ExpenseStatus,
} from "../api/hooks";
import { ExpensesTable } from "../components/ExpensesTable";
import { SubmitExpenseDialog } from "../components/SubmitExpenseDialog";
import { ExpenseDecideDialog } from "../components/ExpenseDecideDialog";

function StatusFilter({
  value,
  onChange,
}: {
  value: ExpenseStatus | "ALL";
  onChange: (next: ExpenseStatus | "ALL") => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ExpenseStatus | "ALL")}
    >
      <SelectTrigger aria-label="Filter by status" className="h-9 min-w-[10rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All statuses</SelectItem>
        {EXPENSE_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function filterBySearch(items: Expense[], term: string): Expense[] {
  const t = term.trim().toLowerCase();
  if (!t) return items;
  return items.filter((e) =>
    [e.description, e.category, e.userName ?? ""]
      .some((field) => field.toLowerCase().includes(t)),
  );
}

function formatInr(cents: number): string {
  const rupees = cents / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function MyExpensesTab() {
  const [status, setStatus] = useState<ExpenseStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const params = useMemo(
    () => (status === "ALL" ? { limit: 100 } : { status, limit: 100 }),
    [status],
  );
  const q = useMyExpenses(params);
  const items = q.data?.items ?? [];
  const filtered = useMemo(() => filterBySearch(items, search), [items, search]);
  const totalInrCents = q.data?.summary?.totalInrCents ?? 0;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>My expenses</CardTitle>
        <StatusFilter value={status} onChange={setStatus} />
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Filter by description or category…"
          ariaLabel="Search my expenses"
        />
        {q.isLoading || !q.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <ExpensesTable
              expenses={filtered}
              showActions={false}
              emptyState={
                search
                  ? "No expenses match your search."
                  : "You haven't submitted any expenses yet."
              }
            />
            {items.length > 0 && (
              <div className="flex justify-end border-t border-border/50 pt-3 text-sm text-muted-foreground">
                <span>
                  Total (INR): <span className="font-mono font-medium text-foreground tabular-nums">{formatInr(totalInrCents)}</span>
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalQueueTab({
  onApprove,
  onReject,
}: {
  onApprove: (e: Expense) => void;
  onReject: (e: Expense) => void;
}) {
  const [status, setStatus] = useState<ExpenseStatus | "ALL">("PENDING");
  const [search, setSearch] = useState("");
  const params = useMemo(
    () => (status === "ALL" ? { limit: 100 } : { status, limit: 100 }),
    [status],
  );
  const q = useAllExpenses(params);
  const items = q.data?.items ?? [];
  const filtered = useMemo(() => filterBySearch(items, search), [items, search]);
  const totalInrCents = q.data?.summary?.totalInrCents ?? 0;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>All expenses</CardTitle>
        <StatusFilter value={status} onChange={setStatus} />
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Filter by description, category, or submitter…"
          ariaLabel="Search all expenses"
        />
        {q.isLoading || !q.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <ExpensesTable
              expenses={filtered}
              showOwner
              showActions
              onApprove={onApprove}
              onReject={onReject}
              emptyState="No expenses match this filter."
            />
            {items.length > 0 && (
              <div className="flex justify-end border-t border-border/50 pt-3 text-sm text-muted-foreground">
                <span>
                  Total (INR): <span className="font-mono font-medium text-foreground tabular-nums">{formatInr(totalInrCents)}</span>
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ExpensesPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  // Approvals are admin-only. HR can no longer decide expenses; the approval
  // queue tab is hidden for non-admins (the API would also 403 the request).
  const isAdmin = role === "ADMIN";

  const [showSubmit, setShowSubmit] = useState(false);
  const [decideTarget, setDecideTarget] = useState<Expense | null>(null);
  const [decideKind, setDecideKind] = useState<"APPROVED" | "REJECTED" | null>(null);

  function openDecide(e: Expense, kind: "APPROVED" | "REJECTED") {
    setDecideTarget(e);
    setDecideKind(kind);
  }

  function closeDecide() {
    setDecideTarget(null);
    setDecideKind(null);
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Expenses"
        description={
          isAdmin
            ? "Submit reimbursements and approve team requests."
            : "Submit reimbursements. Only Admins can approve expenses."
        }
        actions={<Button onClick={() => setShowSubmit(true)}>+ Submit expense</Button>}
      />

      {isAdmin ? (
        <Tabs defaultValue="mine" className="space-y-4">
          <TabsList>
            <TabsTrigger value="mine">My expenses</TabsTrigger>
            <TabsTrigger value="all">All expenses (approval queue)</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="space-y-4">
            <MyExpensesTab />
          </TabsContent>
          <TabsContent value="all" className="space-y-4">
            <ApprovalQueueTab
              onApprove={(e) => openDecide(e, "APPROVED")}
              onReject={(e) => openDecide(e, "REJECTED")}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <MyExpensesTab />
      )}

      <SubmitExpenseDialog open={showSubmit} onOpenChange={setShowSubmit} />

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
