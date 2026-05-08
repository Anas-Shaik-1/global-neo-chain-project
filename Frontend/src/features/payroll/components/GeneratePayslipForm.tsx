import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmployeesList } from "@/features/employees/api/hooks";
import {
  BREAKDOWN_KINDS,
  useCreatePayslip,
  type BreakdownItem,
  type Payslip,
} from "../api/hooks";
import { GeneratePayslipSchema, type GeneratePayslipValues } from "../schemas";

interface Props {
  onCreated?: (payslip: Payslip) => void;
}

function defaultMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface FormShape {
  userId: string;
  month: string;
  // Currency is fixed to INR for the platform — kept on the form shape so
  // the GeneratePayslipSchema (which still requires it) parses cleanly,
  // but no longer exposed in the UI.
  currency: string;
  gross: string;
  notes: string;
  breakdown: { label: string; amount: string; kind: (typeof BREAKDOWN_KINDS)[number] }[];
}

const DEFAULT_CURRENCY = "INR";

const SELECT_PLACEHOLDER = "__placeholder__";

export function GeneratePayslipForm({ onCreated }: Props) {
  const employeesQ = useEmployeesList({ limit: 100 });
  const create = useCreatePayslip();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Confirmation gate — payslip generation is auditable and triggers a
  // SALARY expense + employee notification, so we double-check before
  // actually firing the mutation. We hold both the original (rupees) form
  // shape — for accurate display in the confirm dialog — and the schema's
  // transformed (paise) values that go to the API. Re-parsing the form
  // shape here would double-transform rupees → paise twice.
  const [pendingDisplay, setPendingDisplay] = useState<FormShape | null>(null);
  const [pendingApi, setPendingApi] = useState<GeneratePayslipValues | null>(null);

  const form = useForm<FormShape>({
    resolver: zodResolver(GeneratePayslipSchema) as never,
    defaultValues: {
      userId: "",
      month: defaultMonth(),
      currency: DEFAULT_CURRENCY,
      gross: "",
      notes: "",
      breakdown: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "breakdown",
  });

  function onSubmit(values: FormShape) {
    setError(null);
    setSuccess(null);
    // The resolver has already transformed rupees → paise on `values`, but
    // the form-level types still reflect the on-screen rupee shape. Capture
    // the on-screen values for the dialog separately from the API-ready
    // values so we don't re-parse and double-multiply by 100.
    setPendingDisplay({ ...form.getValues() });
    setPendingApi(values as unknown as GeneratePayslipValues);
  }

  async function confirmGenerate() {
    if (!pendingApi) return;
    try {
      const breakdown: BreakdownItem[] | undefined =
        pendingApi.breakdown && pendingApi.breakdown.length > 0
          ? pendingApi.breakdown.map((r) => ({
              label: r.label,
              amount: r.amount,
              kind: r.kind,
            }))
          : undefined;
      const created = await create.mutateAsync({
        userId: pendingApi.userId,
        month: pendingApi.month,
        currency: pendingApi.currency,
        gross: pendingApi.gross,
        breakdown,
        notes: pendingApi.notes ? pendingApi.notes : undefined,
      });
      setSuccess(`Payslip generated for ${created.userName ?? created.userId}.`);
      form.reset({
        userId: "",
        month: defaultMonth(),
        currency: DEFAULT_CURRENCY,
        gross: "",
        notes: "",
        breakdown: [],
      });
      onCreated?.(created);
      setPendingApi(null);
      setPendingDisplay(null);
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e2.response?.data?.message ?? e2.message ?? "Failed to create payslip");
      setPendingApi(null);
      setPendingDisplay(null);
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select
                      value={field.value || SELECT_PLACEHOLDER}
                      onValueChange={(v) =>
                        field.onChange(v === SELECT_PLACEHOLDER ? "" : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="— select an employee —" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SELECT_PLACEHOLDER}>
                          — select an employee —
                        </SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} ({emp.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month (YYYY-MM)</FormLabel>
                    <FormControl>
                      <Input placeholder="2026-04" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="gross"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross (in ₹)</FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3 select-none text-sm font-medium text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        inputMode="decimal"
                        placeholder="50000"
                        className="pl-8"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Breakdown items</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => append({ label: "", amount: "0", kind: "EARNING" })}
                >
                  + Add row
                </Button>
              </div>
              {fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No breakdown items. Net = gross.
                </p>
              ) : (
                <div className="space-y-2">
                  {fields.map((row, idx) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_120px_140px_auto]"
                    >
                      <FormField
                        control={form.control}
                        name={`breakdown.${idx}.label` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                aria-label="Label"
                                placeholder="e.g. Bonus, Tax"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`breakdown.${idx}.amount` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="relative flex items-center">
                                <span className="pointer-events-none absolute left-2.5 select-none text-xs font-medium text-muted-foreground">
                                  ₹
                                </span>
                                <Input
                                  aria-label="Amount in rupees"
                                  inputMode="decimal"
                                  placeholder="amount in ₹"
                                  className="pl-7"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`breakdown.${idx}.kind` as const}
                        render={({ field }) => (
                          <FormItem>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger aria-label="Kind">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BREAKDOWN_KINDS.map((k) => (
                                  <SelectItem key={k} value={k}>
                                    {k}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      maxLength={1000}
                      placeholder="Any notes for this payslip"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              <Button type="submit" disabled={pending || form.formState.isSubmitting}>
                {pending ? "Generating..." : "Generate payslip"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>

      <ConfirmDialog
        open={pendingDisplay !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingDisplay(null);
            setPendingApi(null);
          }
        }}
        title="Generate this payslip?"
        description={
          pendingDisplay ? (
            <ConfirmSummary
              employees={employeesQ.data?.items ?? []}
              values={pendingDisplay}
            />
          ) : null
        }
        confirmLabel="Yes, generate payslip"
        onConfirm={confirmGenerate}
        isPending={create.isPending}
      />
    </Card>
  );
}

/**
 * Summary block shown inside the confirmation dialog. Shows who's being
 * paid, for which month, and the gross/net figures so admins can sanity-
 * check before committing — payslip generation also creates a SALARY
 * expense entry and notifies the employee, so the diff matters.
 */
function ConfirmSummary({
  employees,
  values,
}: {
  employees: { id: string; name: string; email: string }[];
  values: FormShape;
}) {
  const employee = employees.find((e) => e.id === values.userId);
  const grossRupees = values.gross || "0";
  const breakdownLines = values.breakdown.filter((b) => b.label.trim().length > 0);
  return (
    <div className="space-y-2">
      <p>
        A SALARY expense entry will be created and the employee will be
        notified. This action is auditable.
      </p>
      <div className="rounded-md border border-border/60 bg-card/40 p-3 text-xs">
        <div>
          <span className="text-muted-foreground">Employee:</span>{" "}
          <span className="font-medium text-foreground">
            {employee?.name ?? values.userId}
          </span>
          {employee && (
            <span className="ml-1 font-mono text-muted-foreground/80">
              ({employee.email})
            </span>
          )}
        </div>
        <div className="mt-1">
          <span className="text-muted-foreground">Month:</span>{" "}
          <span className="font-mono font-medium text-foreground">
            {values.month}
          </span>
        </div>
        <div className="mt-1">
          <span className="text-muted-foreground">Gross:</span>{" "}
          <span className="font-mono font-medium text-foreground">
            ₹{grossRupees}
          </span>
        </div>
        {breakdownLines.length > 0 && (
          <div className="mt-1">
            <span className="text-muted-foreground">Breakdown:</span>{" "}
            <span className="text-foreground">{breakdownLines.length} item(s)</span>
          </div>
        )}
      </div>
    </div>
  );
}
