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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDecideExpense, type Expense } from "../api/hooks";
import { ExpenseDecideSchema, type ExpenseDecideValues } from "../schemas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  decision: "APPROVED" | "REJECTED" | null;
}

export function ExpenseDecideDialog({ open, onOpenChange, expense, decision }: Props) {
  const decide = useDecideExpense();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ExpenseDecideValues>({
    resolver: zodResolver(ExpenseDecideSchema),
    defaultValues: { decision: decision ?? "APPROVED", note: "" },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ decision: decision ?? "APPROVED", note: "" });
      setError(null);
    } else if (decision) {
      form.setValue("decision", decision);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, decision]);

  if (!expense || !decision) return null;

  function onSubmit(values: ExpenseDecideValues) {
    if (!expense || !decision) return;
    setError(null);
    decide.mutate(
      {
        id: expense.id,
        decision: values.decision,
        note: values.note ? values.note : undefined,
      },
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      maxLength={500}
                      placeholder={
                        decision === "APPROVED"
                          ? "Looks good"
                          : "Missing receipt; please resubmit"
                      }
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={decide.isPending || form.formState.isSubmitting}
                variant={decision === "REJECTED" ? "destructive" : "default"}
              >
                {decide.isPending ? "Saving..." : `Confirm ${verb.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
