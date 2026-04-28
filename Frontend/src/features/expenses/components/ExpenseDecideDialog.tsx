import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useDecideExpense, type Expense } from "../api/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  decision: "APPROVED" | "REJECTED" | null;
}

export function ExpenseDecideDialog({ open, onOpenChange, expense, decision }: Props) {
  const decide = useDecideExpense();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNote("");
      setError(null);
    }
  }, [open]);

  if (!expense || !decision) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!expense || !decision) return;
    setError(null);
    decide.mutate(
      { id: expense.id, decision, note: note || undefined },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError((err as Error).message ?? "Failed to record decision"),
      },
    );
  }

  const verb = decision === "APPROVED" ? "Approve" : "Reject";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{verb} expense</DialogTitle>
          <DialogDescription>
            {expense.userName ?? "Employee"} — {expense.category} —{" "}
            {(expense.amount / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {expense.currency}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="decide-note">Note (optional)</Label>
            <textarea
              id="decide-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder={
                decision === "APPROVED"
                  ? "Looks good"
                  : "Missing receipt; please resubmit"
              }
            />
          </div>
          {error && (
            <div role="alert" className="text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={decide.isPending}
              variant={decision === "REJECTED" ? "destructive" : "default"}
            >
              {decide.isPending ? "Saving..." : `Confirm ${verb.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
