import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ExpenseStatus | "ALL")}
      className="flex h-9 min-w-[10rem] rounded-md border border-input bg-background px-3 py-1 text-sm"
      aria-label="Filter by status"
    >
      <option value="ALL">All statuses</option>
      {EXPENSE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function MyExpensesTab() {
  const [status, setStatus] = useState<ExpenseStatus | "ALL">("ALL");
  const params = useMemo(
    () => (status === "ALL" ? { limit: 100 } : { status, limit: 100 }),
    [status],
  );
  const q = useMyExpenses(params);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>My expenses</CardTitle>
        <StatusFilter value={status} onChange={setStatus} />
      </CardHeader>
      <CardContent>
        {q.isLoading || !q.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ExpensesTable
            expenses={q.data.items}
            emptyState="You haven't submitted any expenses yet."
          />
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
  const params = useMemo(
    () => (status === "ALL" ? { limit: 100 } : { status, limit: 100 }),
    [status],
  );
  const q = useAllExpenses(params);
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>All expenses</CardTitle>
        <StatusFilter value={status} onChange={setStatus} />
      </CardHeader>
      <CardContent>
        {q.isLoading || !q.data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <ExpensesTable
            expenses={q.data.items}
            showOwner
            onApprove={onApprove}
            onReject={onReject}
            emptyState="No expenses match this filter."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ExpensesPage() {
  const role = useAppSelector((s) => s.auth.user?.role);
  const isElevated = role === "HR" || role === "ADMIN";

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
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <Button onClick={() => setShowSubmit(true)}>+ Submit expense</Button>
      </div>

      {isElevated ? (
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
    </div>
  );
}
