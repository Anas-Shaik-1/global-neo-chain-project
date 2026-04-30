import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import {
  EXPENSE_CATEGORIES,
  useCreateExpense,
  useUploadReceipt,
  type Expense,
} from "../api/hooks";
import { SubmitExpenseSchema, type SubmitExpenseValues } from "../schemas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (expense: Expense) => void;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FormShape {
  amount: string;
  currency: "USD" | "INR";
  category: SubmitExpenseValues["category"];
  description: string;
  incurredOn: string;
}

export function SubmitExpenseDialog({ open, onOpenChange, onSubmitted }: Props) {
  const create = useCreateExpense();
  const upload = useUploadReceipt();
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // We accept the raw string input for amount/incurredOn and let zod coerce on
  // submit — that keeps the field UX simple while still type-safe at the edge.
  const form = useForm<FormShape>({
    resolver: zodResolver(SubmitExpenseSchema) as never,
    defaultValues: {
      amount: "",
      currency: "INR",
      category: "MEALS",
      description: "",
      incurredOn: todayDateString(),
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        amount: "",
        currency: "INR",
        category: "MEALS",
        description: "",
        incurredOn: todayDateString(),
      });
      setReceipt(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormShape) {
    setError(null);
    try {
      const parsed = SubmitExpenseSchema.parse(values);
      const created = await create.mutateAsync({
        amount: parsed.amount,
        currency: parsed.currency,
        category: parsed.category,
        description: parsed.description,
        incurredOn: parsed.incurredOn.toISOString(),
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Amount (in cents)</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="1500"
                        {...field}
                      />
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INR">₹ INR</SelectItem>
                        <SelectItem value="USD">$ USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
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
                name="incurredOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date incurred</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      maxLength={500}
                      placeholder="Team dinner with prospect"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <Label htmlFor="exp-receipt">Receipt (optional, PDF or image)</Label>
              {/* File picker stays a raw <input type="file"> by design. */}
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
              <Button type="submit" disabled={pending || form.formState.isSubmitting}>
                {pending ? "Submitting..." : "Submit expense"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
