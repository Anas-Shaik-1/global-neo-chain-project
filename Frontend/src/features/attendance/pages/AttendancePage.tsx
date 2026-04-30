import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  CalendarDays,
  Globe,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { MetricCard } from "@/components/common/MetricCard";
import {
  useClockIn,
  useClockOut,
  useStartLunch,
  useEndLunch,
  useMyMonth,
  currentMonthString,
  todayUtcString,
  type AttendanceEntry,
} from "../api/hooks";

const ONE_HOUR_MS = 60 * 60 * 1000;

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

function formatDecimalHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(1)}h`;
}

function shiftMonth(monthStr: string, delta: number): string {
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthStr;
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
  isRemoteDraft,
  setIsRemoteDraft,
  onClockIn,
  onClockOut,
  onStartLunch,
  onEndLunch,
  pending,
  error,
  now,
}: {
  todayEntry: AttendanceEntry | null;
  isRemoteDraft: boolean;
  setIsRemoteDraft: (v: boolean) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onStartLunch: () => void;
  onEndLunch: () => void;
  pending: boolean;
  error: string | null;
  now: number;
}) {
  // Derive state.
  const notClockedIn = !todayEntry;
  const clockedOut = !!todayEntry?.clockOut;
  const onLunch =
    !!todayEntry &&
    !todayEntry.clockOut &&
    !!todayEntry.lunchStart &&
    !todayEntry.lunchEnd;
  const lunchEnded =
    !!todayEntry &&
    !todayEntry.clockOut &&
    !!todayEntry.lunchStart &&
    !!todayEntry.lunchEnd;
  const clockedInNoLunch =
    !!todayEntry && !todayEntry.clockOut && !todayEntry.lunchStart;

  // Compute clock-out availability (must be 1h+ after clockIn).
  let canClockOut = false;
  let minutesUntilClockOut = 0;
  if (todayEntry && !todayEntry.clockOut) {
    const elapsed = now - new Date(todayEntry.clockIn).getTime();
    canClockOut = elapsed >= ONE_HOUR_MS;
    minutesUntilClockOut = Math.max(
      0,
      Math.ceil((ONE_HOUR_MS - elapsed) / 60000),
    );
  }

  // Status text.
  let status: string;
  let detail: string | null = null;
  if (notClockedIn) {
    status = "Not clocked in yet";
  } else if (clockedOut && todayEntry) {
    status = `Clocked out at ${formatTime(todayEntry.clockOut)}`;
    const parts: string[] = [];
    if (todayEntry.durationMinutes !== null) {
      parts.push(`${formatHoursMinutes(todayEntry.durationMinutes)} worked`);
    }
    if (todayEntry.lunchMinutes > 0) {
      parts.push(`${todayEntry.lunchMinutes}m lunch`);
    }
    detail = parts.length ? parts.join(" • ") : null;
  } else if (todayEntry) {
    status = `Clocked in at ${formatTime(todayEntry.clockIn)}`;
    const elapsedMin = Math.max(
      0,
      Math.floor((now - new Date(todayEntry.clockIn).getTime()) / 60000),
    );
    const detailParts: string[] = [`Running for ${formatHoursMinutes(elapsedMin)}`];
    if (onLunch) detailParts.push("on lunch");
    else if (lunchEnded && todayEntry.lunchMinutes > 0) {
      detailParts.push(`lunch ${todayEntry.lunchMinutes}m`);
    }
    detail = detailParts.join(" • ");
  } else {
    status = "Not clocked in yet";
  }

  const showRemoteBadge = !!todayEntry?.isRemote;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Today
          {showRemoteBadge && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              title="Working remotely"
            >
              <Globe className="h-3 w-3" />
              Remote
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="font-display text-2xl font-semibold tracking-tight">
            {status}
          </div>
          {detail && (
            <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
          )}
        </div>

        {notClockedIn && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="remote-toggle"
                checked={isRemoteDraft}
                onCheckedChange={setIsRemoteDraft}
              />
              <Label htmlFor="remote-toggle" className="cursor-pointer text-sm">
                Working remotely today
              </Label>
            </div>
            <Button
              onClick={onClockIn}
              disabled={pending}
              size="lg"
              className="w-full sm:w-auto"
            >
              <LogIn className="mr-2 h-4 w-4" />
              {pending ? "Clocking in…" : "Clock In"}
            </Button>
          </div>
        )}

        {clockedInNoLunch && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onStartLunch}
              disabled={pending}
              variant="outline"
              size="lg"
            >
              <Utensils className="mr-2 h-4 w-4" />
              Start lunch
            </Button>
            <Button
              onClick={onClockOut}
              disabled={pending || !canClockOut}
              size="lg"
              title={
                canClockOut
                  ? undefined
                  : "You can clock out 1 hour after clock-in"
              }
            >
              <LogOut className="mr-2 h-4 w-4" />
              {canClockOut
                ? pending
                  ? "Clocking out…"
                  : "Clock Out"
                : `Available in ${minutesUntilClockOut}m`}
            </Button>
          </div>
        )}

        {onLunch && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onEndLunch} disabled={pending} size="lg">
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              End lunch
            </Button>
            <Button
              onClick={onClockOut}
              disabled={pending || !canClockOut}
              variant="outline"
              size="lg"
              title={
                canClockOut
                  ? undefined
                  : "You can clock out 1 hour after clock-in"
              }
            >
              <LogOut className="mr-2 h-4 w-4" />
              {canClockOut
                ? "Clock Out"
                : `Clock out in ${minutesUntilClockOut}m`}
            </Button>
          </div>
        )}

        {lunchEnded && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onClockOut}
              disabled={pending || !canClockOut}
              size="lg"
              title={
                canClockOut
                  ? undefined
                  : "You can clock out 1 hour after clock-in"
              }
            >
              <LogOut className="mr-2 h-4 w-4" />
              {canClockOut
                ? pending
                  ? "Clocking out…"
                  : "Clock Out"
                : `Available in ${minutesUntilClockOut}m`}
            </Button>
          </div>
        )}

        {clockedOut && (
          <Button disabled size="lg" className="w-full sm:w-auto">
            Done for the day
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
  const startLunchMut = useStartLunch();
  const endLunchMut = useEndLunch();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRemoteDraft, setIsRemoteDraft] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Tick "now" once a minute so the running-time and 1hr-rule render live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = todayUtcString();
  const isCurrentMonth = month === currentMonthString();
  const todayEntry = useMemo(
    () =>
      isCurrentMonth ? data?.entries.find((e) => e.date === today) ?? null : null,
    [data, today, isCurrentMonth],
  );

  const totalLunchMinutes = useMemo(
    () => (data?.entries ?? []).reduce((sum, e) => sum + (e.lunchMinutes ?? 0), 0),
    [data],
  );

  function onClockIn() {
    setActionError(null);
    clockInMut.mutate(
      { isRemote: isRemoteDraft },
      {
        onError: (err) =>
          setActionError((err as Error).message ?? "Failed to clock in"),
      },
    );
  }

  function onClockOut() {
    setActionError(null);
    clockOutMut.mutate(
      {},
      {
        onError: (err) =>
          setActionError((err as Error).message ?? "Failed to clock out"),
      },
    );
  }

  function onStartLunch() {
    setActionError(null);
    startLunchMut.mutate(undefined, {
      onError: (err) =>
        setActionError((err as Error).message ?? "Failed to start lunch"),
    });
  }

  function onEndLunch() {
    setActionError(null);
    endLunchMut.mutate(undefined, {
      onError: (err) =>
        setActionError((err as Error).message ?? "Failed to end lunch"),
    });
  }

  const pending =
    clockInMut.isPending ||
    clockOutMut.isPending ||
    startLunchMut.isPending ||
    endLunchMut.isPending;

  return (
    <PageContainer width="default" className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Clock in to start your day."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10ch] text-center font-mono text-sm font-medium">
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
        }
      />

      {isCurrentMonth && (
        <StatusCard
          todayEntry={todayEntry}
          isRemoteDraft={isRemoteDraft}
          setIsRemoteDraft={setIsRemoteDraft}
          onClockIn={onClockIn}
          onClockOut={onClockOut}
          onStartLunch={onStartLunch}
          onEndLunch={onEndLunch}
          pending={pending}
          error={actionError}
          now={now}
        />
      )}

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Total worked hours"
            value={formatHoursMinutes(data.totalMinutes)}
            hint={`${data.entries.length} ${data.entries.length === 1 ? "entry" : "entries"}`}
            icon={<Clock className="h-5 w-5" />}
            accent
          />
          <MetricCard
            label="Days worked"
            value={data.daysWorked}
            hint={monthLabel(month)}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <MetricCard
            label="Lunch deducted"
            value={formatDecimalHours(totalLunchMinutes)}
            hint={`${totalLunchMinutes}m total`}
            icon={<Utensils className="h-5 w-5" />}
          />
        </div>
      )}

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
                    <th>Lunch</th>
                    <th>Remote</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{e.date}</td>
                      <td className="font-mono text-xs">{formatTime(e.clockIn)}</td>
                      <td className="font-mono text-xs">{formatTime(e.clockOut)}</td>
                      <td>
                        {e.durationMinutes !== null
                          ? formatHoursMinutes(e.durationMinutes)
                          : "—"}
                      </td>
                      <td className="text-muted-foreground">
                        {e.lunchMinutes > 0 ? `${e.lunchMinutes} min` : "—"}
                      </td>
                      <td>
                        {e.isRemote ? (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Globe className="h-3.5 w-3.5" /> yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground">no</span>
                        )}
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
    </PageContainer>
  );
}
