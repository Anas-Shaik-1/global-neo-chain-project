import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { GeneratePayslipSchema } from "../schemas";

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
  currency: string;
  gross: string;
  notes: string;
  breakdown: { label: string; amount: string; kind: (typeof BREAKDOWN_KINDS)[number] }[];
}

const SELECT_PLACEHOLDER = "__placeholder__";

export function GeneratePayslipForm({ onCreated }: Props) {
  const employeesQ = useEmployeesList({ limit: 100 });
  const create = useCreatePayslip();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<FormShape>({
    resolver: zodResolver(GeneratePayslipSchema) as never,
    defaultValues: {
      userId: "",
      month: defaultMonth(),
      currency: "USD",
      gross: "",
      notes: "",
      breakdown: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "breakdown",
  });

  async function onSubmit(values: FormShape) {
    setError(null);
    setSuccess(null);
    try {
      const parsed = GeneratePayslipSchema.parse(values);
      const breakdown: BreakdownItem[] | undefined =
        parsed.breakdown && parsed.breakdown.length > 0
          ? parsed.breakdown.map((r) => ({ label: r.label, amount: r.amount, kind: r.kind }))
          : undefined;
      const created = await create.mutateAsync({
        userId: parsed.userId,
        month: parsed.month,
        currency: parsed.currency,
        gross: parsed.gross,
        breakdown,
        notes: parsed.notes ? parsed.notes : undefined,
      });
      setSuccess(`Payslip generated for ${created.userName ?? created.userId}.`);
      form.reset({
        userId: "",
        month: defaultMonth(),
        currency: "USD",
        gross: "",
        notes: "",
        breakdown: [],
      });
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="gross"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Gross (in cents)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="500000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={3}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                              <Input
                                aria-label="Amount"
                                inputMode="numeric"
                                placeholder="amount (cents)"
                                {...field}
                              />
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
    </Card>
  );
}
