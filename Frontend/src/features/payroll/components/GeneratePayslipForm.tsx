import { useState, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEmployeesList } from "@/features/employees/api/hooks";
import {
  BREAKDOWN_KINDS,
  useCreatePayslip,
  type BreakdownItem,
  type BreakdownKind,
  type Payslip,
} from "../api/hooks";

interface BreakdownRow extends BreakdownItem {
  rowId: number;
}

interface Props {
  onCreated?: (payslip: Payslip) => void;
}

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function GeneratePayslipForm({ onCreated }: Props) {
  const employeesQ = useEmployeesList({ limit: 100 });
  const create = useCreatePayslip();

  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(defaultMonth());
  const [currency, setCurrency] = useState("USD");
  const [gross, setGross] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [nextRowId, setNextRowId] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function addRow() {
    setRows((r) => [
      ...r,
      { rowId: nextRowId, label: "", amount: 0, kind: "EARNING" },
    ]);
    setNextRowId((n) => n + 1);
  }

  function removeRow(id: number) {
    setRows((r) => r.filter((x) => x.rowId !== id));
  }

  function updateRow(id: number, patch: Partial<BreakdownRow>) {
    setRows((r) => r.map((x) => (x.rowId === id ? { ...x, ...patch } : x)));
  }

  function reset() {
    setUserId("");
    setMonth(defaultMonth());
    setCurrency("USD");
    setGross("");
    setNotes("");
    setRows([]);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!userId) {
      setError("Please choose an employee.");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      setError("Month must be in YYYY-MM format.");
      return;
    }
    const numGross = Number(gross);
    if (!Number.isFinite(numGross) || numGross < 0) {
      setError("Gross must be a non-negative number (in cents).");
      return;
    }
    for (const row of rows) {
      if (!row.label.trim()) {
        setError("Every breakdown row needs a label.");
        return;
      }
      if (!Number.isFinite(row.amount) || row.amount < 0) {
        setError("Breakdown amounts must be non-negative.");
        return;
      }
    }
    try {
      const breakdown: BreakdownItem[] = rows.map((r) => ({
        label: r.label.trim(),
        amount: r.amount,
        kind: r.kind,
      }));
      const created = await create.mutateAsync({
        userId,
        month,
        currency: currency.trim().toUpperCase() || "USD",
        gross: numGross,
        breakdown: breakdown.length > 0 ? breakdown : undefined,
        notes: notes.trim() || undefined,
      });
      setSuccess(`Payslip generated for ${created.userName ?? created.userId}.`);
      reset();
      onCreated?.(created);
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2.response?.data?.message ?? e2.message ?? "Failed to create payslip");
    }
  }

  const employees = employeesQ.data?.items ?? [];
  const pending = create.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate payslip</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payroll-user">Employee</Label>
              <select
                id="payroll-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">— select an employee —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-month">Month (YYYY-MM)</Label>
              <Input
                id="payroll-month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="2026-04"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payroll-gross">Gross (in cents)</Label>
              <Input
                id="payroll-gross"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-currency">Currency</Label>
              <Input
                id="payroll-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                minLength={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Breakdown items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addRow}>
                + Add row
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No breakdown items. Net = gross.
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div
                    key={row.rowId}
                    className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_120px_140px_auto]"
                  >
                    <Input
                      aria-label="Label"
                      value={row.label}
                      onChange={(e) => updateRow(row.rowId, { label: e.target.value })}
                      placeholder="e.g. Bonus, Tax"
                    />
                    <Input
                      aria-label="Amount"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={String(row.amount)}
                      onChange={(e) =>
                        updateRow(row.rowId, { amount: Number(e.target.value) || 0 })
                      }
                      placeholder="amount (cents)"
                    />
                    <select
                      aria-label="Kind"
                      value={row.kind}
                      onChange={(e) =>
                        updateRow(row.rowId, { kind: e.target.value as BreakdownKind })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {BREAKDOWN_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(row.rowId)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="payroll-notes">Notes (optional)</Label>
            <textarea
              id="payroll-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Any notes for this payslip"
            />
          </div>

          {error && (
            <div role="alert" className="text-sm text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Generating..." : "Generate payslip"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
