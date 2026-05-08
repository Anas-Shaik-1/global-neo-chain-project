import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  useAdminEditAttendance,
  type AttendanceEntry,
} from "../api/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: AttendanceEntry | null;
}

/**
 * The attendance entry's `date` is fixed (it's *the* day this row is for).
 * We only need to capture HH:MM for each timestamp; the date portion stays
 * pinned to the entry's existing date in local time. These two helpers
 * convert ISO ↔ "HH:MM".
 */
function isoToHHMM(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hhmmToIsoOnDate(hhmm: string, dateStr: string): string | null {
  if (!hhmm || !dateStr) return null;
  // Build a local-time Date pinned to the entry's calendar date but with
  // the new HH:MM. toISOString gives us a tz-correct UTC representation.
  const [h, m] = hhmm.split(":").map((s) => Number(s));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const [yStr, moStr, dStr] = dateStr.split("-");
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  if (![y, mo, d].every(Number.isFinite)) return null;
  const local = new Date(y, mo - 1, d, h, m, 0, 0);
  return local.toISOString();
}

export function EditAttendanceDialog({ open, onOpenChange, entry }: Props) {
  const edit = useAdminEditAttendance();
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [lunchStart, setLunchStart] = useState("");
  const [lunchEnd, setLunchEnd] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isAbsent, setIsAbsent] = useState(false);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setClockIn(isoToHHMM(entry.clockIn));
    setClockOut(isoToHHMM(entry.clockOut));
    setLunchStart(isoToHHMM(entry.lunchStart));
    setLunchEnd(isoToHHMM(entry.lunchEnd));
    setIsRemote(entry.isRemote);
    setIsAbsent(!!entry.isAbsent);
    setNotes(entry.notes ?? "");
    setReason("");
  }, [entry]);

  if (!entry) return null;

  function buildPatch(): Record<string, unknown> {
    if (!entry) return {};
    const patch: Record<string, unknown> = {};

    // The absent flag short-circuits everything else — when ON, only it is
    // sent (the server handles zeroing timestamps). When OFF, the times +
    // remote flag drive the diff.
    if (isAbsent !== !!entry.isAbsent) {
      patch.isAbsent = isAbsent;
    }

    if (!isAbsent) {
      const newClockIn = hhmmToIsoOnDate(clockIn, entry.date);
      if (newClockIn && newClockIn !== entry.clockIn) {
        patch.clockIn = newClockIn;
      }
      const newClockOut = clockOut
        ? hhmmToIsoOnDate(clockOut, entry.date)
        : null;
      if (newClockOut !== entry.clockOut) {
        patch.clockOut = newClockOut;
      }
      const newLunchStart = lunchStart
        ? hhmmToIsoOnDate(lunchStart, entry.date)
        : null;
      if (newLunchStart !== entry.lunchStart) {
        patch.lunchStart = newLunchStart;
      }
      const newLunchEnd = lunchEnd
        ? hhmmToIsoOnDate(lunchEnd, entry.date)
        : null;
      if (newLunchEnd !== entry.lunchEnd) {
        patch.lunchEnd = newLunchEnd;
      }
      if (isRemote !== entry.isRemote) patch.isRemote = isRemote;
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes !== (entry.notes ?? "")) {
      patch.notes = trimmedNotes.length > 0 ? trimmedNotes : null;
    }
    if (reason.trim().length > 0) patch.reason = reason.trim();
    return patch;
  }

  const patch = buildPatch();
  const editableKeys = Object.keys(patch).filter((k) => k !== "reason");
  const hasChanges = editableKeys.length > 0;

  async function performSave() {
    if (!entry) return;
    if (!hasChanges) {
      setConfirmOpen(false);
      onOpenChange(false);
      return;
    }
    await edit.mutateAsync({ id: entry.id, input: patch }).then(
      () => {
        setConfirmOpen(false);
        onOpenChange(false);
      },
      () => {
        // Mutation surfaces a toast on its own; keep the dialog open so the
        // admin can retry without re-typing.
        setConfirmOpen(false);
      },
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit attendance — {entry.date}</DialogTitle>
            <DialogDescription>
              Adjust the entry's timings. The employee will be notified of any
              change. The optional reason is included verbatim in the
              notification.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <div className="flex flex-col">
                <Label htmlFor="edit-absent" className="cursor-pointer text-sm font-medium text-amber-200">
                  Mark as absent
                </Label>
                <span className="text-xs text-amber-300/80">
                  Clears all timings and reports 0h worked.
                </span>
              </div>
              <Switch
                id="edit-absent"
                checked={isAbsent}
                onCheckedChange={setIsAbsent}
              />
            </div>

            {!isAbsent && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Clock in" required>
                    <Input
                      type="time"
                      value={clockIn}
                      onChange={(e) => setClockIn(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Clock out">
                    <Input
                      type="time"
                      value={clockOut}
                      onChange={(e) => setClockOut(e.target.value)}
                    />
                  </Field>
                  <Field label="Lunch start">
                    <Input
                      type="time"
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                    />
                  </Field>
                  <Field label="Lunch end">
                    <Input
                      type="time"
                      value={lunchEnd}
                      onChange={(e) => setLunchEnd(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2.5">
                  <Label htmlFor="edit-remote" className="cursor-pointer text-sm">
                    Working remotely
                  </Label>
                  <Switch
                    id="edit-remote"
                    checked={isRemote}
                    onCheckedChange={setIsRemote}
                  />
                </div>
              </>
            )}

            <Field label="Notes">
              <Textarea
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes for the entry"
              />
            </Field>

            <Field
              label="Reason for change (optional)"
              hint="Sent to the employee's notification feed verbatim."
            >
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="e.g. forgot to clock out"
              />
            </Field>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={edit.isPending || !hasChanges}>
                {edit.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isAbsent ? "Mark this day as absent?" : "Save attendance changes?"}
        description={
          <div className="space-y-2">
            <p>
              The employee will receive a notification reflecting the updated
              timings. This is auditable and can't be silently undone.
            </p>
            {editableKeys.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Fields changed:{" "}
                <span className="font-mono text-foreground/80">
                  {editableKeys.join(", ")}
                </span>
              </p>
            )}
          </div>
        }
        confirmLabel={isAbsent ? "Mark absent" : "Save changes"}
        tone={isAbsent ? "destructive" : "default"}
        onConfirm={performSave}
        isPending={edit.isPending}
      />
    </>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
