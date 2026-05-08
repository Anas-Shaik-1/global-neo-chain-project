import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useAppSelector } from "@/app/hooks";
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_VISIBILITIES,
  type CalendarEntry,
  type CalendarEventKind,
  type CalendarVisibility,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from "../api/hooks";
import { MeetingNotes } from "./MeetingNotes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this existing entry. Null = create mode. */
  entry: CalendarEntry | null;
  /** Used in create mode to seed the start date (clicked-day in month grid). */
  defaultDate?: Date;
}

const Schema = z
  .object({
    kind: z.enum(CALENDAR_EVENT_KINDS),
    visibility: z.enum(CALENDAR_VISIBILITIES),
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional(),
    location: z.string().max(300).optional(),
    /** YYYY-MM-DD */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    /** HH:MM, ignored when allDay or kind=REMINDER without time */
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM").optional().or(z.literal("")),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM").optional().or(z.literal("")),
    allDay: z.boolean(),
    reminderMinutesBefore: z.string().optional(),
    attendees: z.array(z.string()).optional(),
  })
  .refine(
    (v) => v.kind === "REMINDER" || v.allDay || (v.startTime && v.endTime),
    {
      message: "EVENT requires start and end times unless it's all-day",
      path: ["endTime"],
    },
  );

type Values = z.infer<typeof Schema>;

const REMINDER_PRESETS: { label: string; minutes: number | null }[] = [
  { label: "No reminder", minutes: null },
  { label: "At start", minutes: 0 },
  { label: "5 minutes before", minutes: 5 },
  { label: "15 minutes before", minutes: 15 },
  { label: "30 minutes before", minutes: 30 },
  { label: "1 hour before", minutes: 60 },
  { label: "1 day before", minutes: 60 * 24 },
];

function isoToParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function partsToIso(date: string, time: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0, 0, 0).toISOString();
}

function dateOnlyIso(date: string): string {
  // Local-midnight ISO for an all-day entry on the given calendar date.
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, 0, 0, 0, 0).toISOString();
}

function dateOnlyIsoEnd(date: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, 23, 59, 59, 999).toISOString();
}

export function EventDialog({
  open,
  onOpenChange,
  entry,
  defaultDate,
}: Props) {
  const me = useAppSelector((s) => s.auth.user);
  const editing = !!entry;
  const create = useCreateCalendarEvent();
  const update = useUpdateCalendarEvent(entry?.id ?? "");
  const del = useDeleteCalendarEvent();
  const employees = useEmployeesList({ limit: 100 });

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      kind: "EVENT",
      visibility: "team",
      title: "",
      description: "",
      location: "",
      date: "",
      startTime: "09:00",
      endTime: "10:00",
      allDay: false,
      reminderMinutesBefore: "",
      attendees: [],
    },
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const startParts = isoToParts(entry.start);
      const endParts = isoToParts(entry.end);
      form.reset({
        kind: entry.kind,
        visibility: entry.visibility,
        title: entry.title,
        description: entry.description ?? "",
        location: entry.location ?? "",
        date: startParts.date,
        startTime: startParts.time,
        endTime: endParts.time,
        allDay: entry.allDay,
        reminderMinutesBefore:
          entry.reminderMinutesBefore === null
            ? ""
            : String(entry.reminderMinutesBefore),
        attendees: entry.attendees.map((a) => a.id),
      });
    } else {
      const seed = defaultDate ?? new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const yyyymmdd = `${seed.getFullYear()}-${pad(seed.getMonth() + 1)}-${pad(seed.getDate())}`;
      form.reset({
        kind: "EVENT",
        visibility: "team",
        title: "",
        description: "",
        location: "",
        date: yyyymmdd,
        startTime: "09:00",
        endTime: "10:00",
        allDay: false,
        reminderMinutesBefore: "",
        attendees: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id, defaultDate?.getTime()]);

  const kind = form.watch("kind");
  const allDay = form.watch("allDay");

  function buildPayload(values: Values) {
    const reminderMinutesBefore =
      values.reminderMinutesBefore === ""
        ? null
        : Number(values.reminderMinutesBefore);

    let start: string;
    let end: string;
    if (values.kind === "REMINDER") {
      // Reminder: a single instant. If no time given, pin to 09:00 local.
      start = partsToIso(values.date, values.startTime || "09:00");
      end = start;
    } else if (values.allDay) {
      start = dateOnlyIso(values.date);
      end = dateOnlyIsoEnd(values.date);
    } else {
      start = partsToIso(values.date, values.startTime || "09:00");
      end = partsToIso(values.date, values.endTime || "10:00");
    }

    return {
      kind: values.kind,
      visibility: values.visibility,
      title: values.title.trim(),
      description: values.description?.trim() ? values.description.trim() : null,
      location: values.location?.trim() ? values.location.trim() : null,
      start,
      end,
      allDay: values.kind === "REMINDER" ? false : values.allDay,
      reminderMinutesBefore,
      attendees: values.attendees ?? [],
    };
  }

  async function onSubmit(values: Values) {
    const payload = buildPayload(values);
    try {
      if (editing && entry) {
        await update.mutateAsync(payload);
      } else {
        await create.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast already fires inside hooks
    }
  }

  async function onDelete() {
    if (!entry) return;
    try {
      await del.mutateAsync(entry.id);
      onOpenChange(false);
    } catch {
      // toast already fires inside hook
    }
  }

  const canManage =
    !editing ||
    (me &&
      (entry?.ownerId === me.id || me.role === "ADMIN"));

  const canPostNotes =
    !!me &&
    !!entry &&
    (entry.ownerId === me.id ||
      me.role === "ADMIN" ||
      entry.attendees.some((a) => a.id === me.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit calendar entry" : "New calendar entry"}
          </DialogTitle>
          <DialogDescription>
            Add an event with start/end times or a single-instant reminder.
            Attendees you invite get a notification immediately and a second
            reminder right before the event starts.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as CalendarEventKind)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EVENT">Event</SelectItem>
                        <SelectItem value="REMINDER">Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as CalendarVisibility)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="private">Private (only me)</SelectItem>
                        <SelectItem value="team">Team (attendees)</SelectItem>
                        <SelectItem value="company">Company-wide</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={
                        kind === "REMINDER"
                          ? "Remind me to…"
                          : "Sprint planning"
                      }
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {kind !== "REMINDER" && !allDay && (
                <>
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              {kind === "REMINDER" && (
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {kind === "EVENT" && (
              <FormField
                control={form.control}
                name="allDay"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2.5">
                    <Label htmlFor="all-day" className="cursor-pointer text-sm">
                      All day
                    </Label>
                    <Switch
                      id="all-day"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Room 4 / Zoom link / address"
                      maxLength={300}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="Agenda, links, context…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderMinutesBefore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notify me</FormLabel>
                  <Select
                    value={field.value === "" ? "__none__" : (field.value ?? "__none__")}
                    onValueChange={(v) =>
                      field.onChange(v === "__none__" ? "" : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No reminder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {REMINDER_PRESETS.map((p) => (
                        <SelectItem
                          key={p.label}
                          value={p.minutes === null ? "__none__" : String(p.minutes)}
                        >
                          {p.label}
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
              name="attendees"
              render={({ field }) => {
                const selected = new Set(field.value ?? []);
                const options = (employees.data?.items ?? []).filter(
                  (u) => u.id !== me?.id,
                );
                return (
                  <FormItem>
                    <FormLabel>Attendees (optional)</FormLabel>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 bg-card/40 p-2">
                      {options.length === 0 ? (
                        <p className="px-1 py-1 text-xs text-muted-foreground">
                          No one to invite yet.
                        </p>
                      ) : (
                        options.map((u) => {
                          const checked = selected.has(u.id);
                          return (
                            <label
                              key={u.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = new Set(field.value ?? []);
                                  if (e.target.checked) next.add(u.id);
                                  else next.delete(u.id);
                                  field.onChange(Array.from(next));
                                }}
                              />
                              <span className="flex-1 truncate">{u.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {u.email}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {editing && canManage && (
                <Button
                  type="button"
                  variant="outline"
                  className="mr-auto gap-1.5 text-destructive hover:bg-destructive/10"
                  onClick={onDelete}
                  disabled={del.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  create.isPending ||
                  update.isPending ||
                  form.formState.isSubmitting ||
                  (editing && !canManage)
                }
              >
                {create.isPending || update.isPending
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        {editing && entry && entry.kind === "EVENT" && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <MeetingNotes eventId={entry.id} canPost={canPostNotes} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
