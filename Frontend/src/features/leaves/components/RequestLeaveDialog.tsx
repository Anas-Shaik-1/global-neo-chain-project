import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_TYPES, useCreateLeave, type LeaveType } from "../api/hooks";

// Today as YYYY-MM-DD in the user's local timezone. Used both as the
// `min` on the date input (so the native picker greys out past days)
// and inside the Zod refine so a typed-in past date still fails before
// the request hits the server. Lexicographic compare is safe because
// the format is fixed-width ISO.
function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildSchema(today: string) {
  return z
    .object({
      type: z.enum(LEAVE_TYPES),
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date")
        .refine((v) => v >= today, { message: "Start date is in the past" }),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
      reason: z.string().trim().min(1, "A reason is required").max(500),
    })
    .refine((v) => v.endDate >= v.startDate, {
      path: ["endDate"],
      message: "End date must be on or after start date",
    });
}

type Values = {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestLeaveDialog({ open, onOpenChange }: Props) {
  const create = useCreateLeave();
  // Today is captured per dialog-open so a long-lived session that crosses
  // midnight still validates against the right "today" the next time the
  // user opens the form.
  const today = useMemo(() => todayLocalIso(), [open]);
  const form = useForm<Values>({
    resolver: zodResolver(buildSchema(today)),
    defaultValues: { type: "CASUAL" as LeaveType, startDate: "", endDate: "", reason: "" },
  });

  useEffect(() => {
    if (open) form.reset({ type: "CASUAL", startDate: "", endDate: "", reason: "" });
  }, [open, form]);

  async function onSubmit(values: Values) {
    await create.mutateAsync(values);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
          <DialogDescription>
            Pick the type, dates, and a short reason. Admins are notified
            automatically.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label htmlFor="type">Type</Label>
            <Select
              value={form.watch("type")}
              onValueChange={(v) => form.setValue("type", v as LeaveType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Start</Label>
              <Input
                id="startDate"
                type="date"
                min={today}
                {...form.register("startDate")}
              />
              {form.formState.errors.startDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.startDate.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">End</Label>
              <Input
                id="endDate"
                type="date"
                min={form.watch("startDate") || today}
                {...form.register("endDate")}
              />
              {form.formState.errors.endDate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.endDate.message}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" rows={3} {...form.register("reason")} />
            {form.formState.errors.reason ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.reason.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
