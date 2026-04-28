import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useClockIn,
  useClockOut,
  useMyMonth,
  currentMonthString,
  todayUtcString,
  type AttendanceEntry,
} from "../api/hooks";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function durationFromNow(start: string): string {
  const ms = Date.now() - new Date(start).getTime();
  if (ms < 0) return "0m";
  const mins = Math.floor(ms / 60000);
  return formatHoursMinutes(mins);
}

function shiftMonth(monthStr: string, delta: number): string {
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthStr;
  // Use UTC math for stability.
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function monthLabel(monthStr: string): string {
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthStr;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function StatusCard({
  todayEntry,
  onClockIn,
  onClockOut,
  pending,
  error,
}: {
  todayEntry: AttendanceEntry | null;
  onClockIn: () => void;
  onClockOut: () => void;
  pending: boolean;
  error: string | null;
}) {
  let status: string;
  let detail: string | null = null;

  if (!todayEntry) {
    status = "Not clocked in yet";
  } else if (!todayEntry.clockOut) {
    status = `Clocked in at ${formatTime(todayEntry.clockIn)}`;
    detail = `Running for ${durationFromNow(todayEntry.clockIn)}`;
  } else {
    status = `Clocked out at ${formatTime(todayEntry.clockOut)}`;
    detail =
      todayEntry.durationMinutes !== null
        ? `Worked ${formatHoursMinutes(todayEntry.durationMinutes)} today`
        : null;
  }

  const showClockOut = todayEntry && !todayEntry.clockOut;
  const alreadyDone = !!todayEntry?.clockOut;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-2xl font-semibold">{status}</div>
          {detail && <div className="mt-1 text-sm text-muted-foreground">{detail}</div>}
        </div>
        {alreadyDone ? (
          <Button disabled size="lg" className="w-full sm:w-auto">
            Done for the day
          </Button>
        ) : showClockOut ? (
          <Button
            onClick={onClockOut}
            disabled={pending}
            size="lg"
            className="w-full sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {pending ? "Clocking out…" : "Clock Out"}
          </Button>
        ) : (
          <Button
            onClick={onClockIn}
            disabled={pending}
            size="lg"
            className="w-full sm:w-auto"
          >
            <LogIn className="mr-2 h-4 w-4" />
            {pending ? "Clocking in…" : "Clock In"}
          </Button>
        )}
        {error && (
          <div className="text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AttendancePage() {
  const [month, setMonth] = useState<string>(() => currentMonthString());
  const { data, isLoading } = useMyMonth(month);
  const clockInMut = useClockIn();
  const clockOutMut = useClockOut();
  const [actionError, setActionError] = useState<string | null>(null);

  const today = todayUtcString();
  const isCurrentMonth = month === currentMonthString();
  const todayEntry = useMemo(
    () => (isCurrentMonth ? data?.entries.find((e) => e.date === today) ?? null : null),
    [data, today, isCurrentMonth],
  );

  function onClockIn() {
    setActionError(null);
    clockInMut.mutate(
      {},
      {
        onError: (err) => setActionError((err as Error).message ?? "Failed to clock in"),
      },
    );
  }

  function onClockOut() {
    setActionError(null);
    clockOutMut.mutate(
      {},
      {
        onError: (err) => setActionError((err as Error).message ?? "Failed to clock out"),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Attendance</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10ch] text-center text-sm font-medium">
            {monthLabel(month)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Next month"
            disabled={month >= currentMonthString()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isCurrentMonth && (
        <StatusCard
          todayEntry={todayEntry}
          onClockIn={onClockIn}
          onClockOut={onClockOut}
          pending={clockInMut.isPending || clockOutMut.isPending}
          error={actionError}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monthly summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total hours
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {formatHoursMinutes(data.totalMinutes)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Days worked
                </div>
                <div className="mt-1 text-2xl font-semibold">{data.daysWorked}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Entries
                </div>
                <div className="mt-1 text-2xl font-semibold">{data.entries.length}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-32 w-full" />
          ) : data.entries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No attendance entries for this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2">Date</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th>Duration</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="py-2">{e.date}</td>
                      <td>{formatTime(e.clockIn)}</td>
                      <td>{formatTime(e.clockOut)}</td>
                      <td>
                        {e.durationMinutes !== null
                          ? formatHoursMinutes(e.durationMinutes)
                          : "—"}
                      </td>
                      <td className="text-muted-foreground">{e.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
