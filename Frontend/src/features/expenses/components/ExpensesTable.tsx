import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge as CommonStatusBadge } from "@/components/common/StatusBadge";
import type { Expense, ExpenseStatus } from "../api/hooks";

const STATUS_TONES = {
  PENDING: "warn",
  APPROVED: "success",
  REJECTED: "danger",
} as const satisfies Record<ExpenseStatus, "warn" | "success" | "danger">;

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <CommonStatusBadge tone={STATUS_TONES[status]}>{status}</CommonStatusBadge>;
}

function formatAmount(amount: number, currency: string): string {
  const major = amount / 100;
  return `${major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

interface Props {
  expenses: Expense[];
  showOwner?: boolean;
  onView?: (expense: Expense) => void;
  onApprove?: (expense: Expense) => void;
  onReject?: (expense: Expense) => void;
  emptyState?: ReactNode;
}

export function ExpensesTable({
  expenses,
  showOwner = false,
  onView,
  onApprove,
  onReject,
  emptyState,
}: Props) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
        {emptyState ?? "No expenses to show."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-3">Date</th>
            {showOwner && <th className="py-2 pr-3">Submitter</th>}
            <th className="py-2 pr-3">Category</th>
            <th className="py-2 pr-3">Description</th>
            <th className="py-2 pr-3 text-right">Amount</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Decision by</th>
            <th className="py-2 pr-3">Receipt</th>
            <th className="py-2 pr-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id} className="border-b border-border/50">
              <td className="py-2 pr-3 whitespace-nowrap">{formatDate(e.incurredOn)}</td>
              {showOwner && (
                <td className="py-2 pr-3 whitespace-nowrap">{e.userName ?? "—"}</td>
              )}
              <td className="py-2 pr-3 whitespace-nowrap">{e.category}</td>
              <td className="py-2 pr-3 max-w-[28ch] truncate" title={e.description}>
                {e.description}
              </td>
              <td className="py-2 pr-3 text-right whitespace-nowrap">
                {formatAmount(e.amount, e.currency)}
              </td>
              <td className="py-2 pr-3">
                <StatusBadge status={e.status} />
              </td>
              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                {e.decisionByName ?? "—"}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {e.receiptUrl ? (
                  <a
                    href={e.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 pr-3 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  {onView && (
                    <Button size="sm" variant="ghost" onClick={() => onView(e)}>
                      View
                    </Button>
                  )}
                  {onApprove && e.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => onApprove(e)}>
                      Approve
                    </Button>
                  )}
                  {onReject && e.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(e)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
