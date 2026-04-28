import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  EXPENSE_CATEGORIES,
  useCreateExpense,
  useUploadReceipt,
  type ExpenseCategory,
  type Expense,
} from "../api/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (expense: Expense) => void;
}

export function SubmitExpenseDialog({ open, onOpenChange, onSubmitted }: Props) {
  const create = useCreateExpense();
  const upload = useUploadReceipt();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState<ExpenseCategory>("MEALS");
  const [description, setDescription] = useState("");
  const [incurredOn, setIncurredOn] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setAmount("");
    setCurrency("USD");
    setCategory("MEALS");
    setDescription("");
    const d = new Date();
    setIncurredOn(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    setReceipt(null);
    setError(null);
  }

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError("Amount must be a non-negative number.");
      return;
    }
    try {
      const created = await create.mutateAsync({
        amount: numAmount,
        currency: currency.trim().toUpperCase() || "USD",
        category,
        description,
        incurredOn: new Date(incurredOn).toISOString(),
      });
      let final = created;
      if (receipt) {
        final = await upload.mutateAsync({ id: created.id, file: receipt });
      }
      onOpenChange(false);
      onSubmitted?.(final);
    } catch (err) {
      setError((err as Error).message ?? "Failed to submit expense");
    }
  }

  const pending = create.isPending || upload.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit expense</DialogTitle>
          <DialogDescription>
            Amounts are stored in the smallest currency unit (e.g. 100 = $1.00).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="exp-amount">Amount (in cents)</Label>
              <Input
                id="exp-amount"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-currency">Currency</Label>
              <Input
                id="exp-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                minLength={3}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exp-category">Category</Label>
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-incurred">Date incurred</Label>
              <Input
                id="exp-incurred"
                required
                type="date"
                value={incurredOn}
                onChange={(e) => setIncurredOn(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-desc">Description</Label>
            <textarea
              id="exp-desc"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder="Team dinner with prospect"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exp-receipt">Receipt (optional, PDF or image)</Label>
            <Input
              id="exp-receipt"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
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
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting..." : "Submit expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
