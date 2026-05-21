import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  CalendarDays,
  Globe,
  Pencil,
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
import { EditAttendanceDialog } from "../components/EditAttendanceDialog";
import { TeamStatusPanel } from "../components/TeamStatusPanel";
import { useAppSelector } from "@/app/hooks";

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

/**
 * Stopwatch-style display: HH:MM:SS. Used while the user is currently
 * clocked in so they have a precise, glanceable read on how long they've
 * been working today.
 */
function formatStopwatch(totalMs: number): string {
  const safe = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  // Manual clock-out is always available while an entry is open. The old
  // 1-hour minimum was removed: users now own their own clock without the
  // server forcing a wait.
  const canClockOut = !!todayEntry && !todayEntry.clockOut;
  void ONE_HOUR_MS;

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

        {/* Live stopwatch — only renders while currently clocked in (not on
            lunch and not yet clocked out). Subtracts the lunch window from
            the running total so the displayed value reflects actual worked
            time, matching what the server records on clock-out. */}
        {todayEntry && !todayEntry.clockOut && !onLunch && (() => {
          const clockInMs = new Date(todayEntry.clockIn).getTime();
          let lunchMs = 0;
          if (todayEntry.lunchStart && todayEntry.lunchEnd) {
            lunchMs = Math.max(
              0,
              new Date(todayEntry.lunchEnd).getTime() -
                new Date(todayEntry.lunchStart).getTime(),
            );
          }
          const workedMs = Math.max(0, now - clockInMs - lunchMs);
          return (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/80">
                Working time
              </div>
              <div className="mt-1 font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground">
                {formatStopwatch(workedMs)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Auto-checkout at midnight if you forget to clock out.
              </div>
            </div>
          );
        })()}

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
            >
              <LogOut className="mr-2 h-4 w-4" />
              {pending ? "Clocking out…" : "Clock Out"}
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
            >
              <LogOut className="mr-2 h-4 w-4" />
              {pending ? "Clocking out…" : "Clock Out"}
            </Button>
          </div>
        )}

        {lunchEnded && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onClockOut}
              disabled={pending || !canClockOut}
              size="lg"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {pending ? "Clocking out…" : "Clock Out"}
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
  const role = useAppSelector((s) => s.auth.user?.role);
  const isAdmin = role === "ADMIN";
  const [editTarget, setEditTarget] = useState<AttendanceEntry | null>(null);

  const today = todayUtcString();
  const isCurrentMonth = month === currentMonthString();
  const todayEntry = useMemo(
    () =>
      isCurrentMonth ? data?.entries.find((e) => e.date === today) ?? null : null,
    [data, today, isCurrentMonth],
  );

  // Tick "now" once per second while the user is currently clocked in (not
  // yet clocked out). Otherwise idle on a 60s tick which is fine for the
  // 1-hour-clock-out gate to refresh. The live tick is what powers the
  // stopwatch in StatusCard.
  const isLiveSession = !!todayEntry && !todayEntry.clockOut;
  useEffect(() => {
    const intervalMs = isLiveSession ? 1000 : 60_000;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [isLiveSession]);

  const totalLunchMinutes = useMemo(
    () => (data?.entries ?? []).reduce((sum, e) => sum + (e.lunchMinutes ?? 0), 0),
    [data],
  );

  async function onClockIn() {
    setActionError(null);

    function submit(input: { isRemote: boolean; latitude?: number; longitude?: number }) {
      clockInMut.mutate(input, {
        onError: (err) =>
          setActionError((err as Error).message ?? "Failed to clock in"),
      });
    }

    // Remote clock-ins bypass the geofence — fire immediately without
    // touching geolocation.
    if (isRemoteDraft) {
      submit({ isRemote: true });
      return;
    }

    // In-office clock-in: try to capture coordinates so the server can
    // verify office presence. If the browser doesn't expose geolocation
    // (older browsers, insecure contexts) we send the request without
    // coords — the backend will accept it if no geofence is configured,
    // and return a clear error otherwise.
    if (!("geolocation" in navigator)) {
      submit({ isRemote: false });
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 15_000,
        });
      });
      submit({
        isRemote: false,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (geoErr) {
      // We don't fail the clock-in client-side on a geolocation error —
      // the backend may not have a geofence configured, in which case
      // the request must still succeed. Surface a tip via the action
      // banner so the user knows why they're seeing a server error if
      // one comes back.
      const code = (geoErr as GeolocationPositionError | undefined)?.code;
      if (code === 1 /* PERMISSION_DENIED */) {
        setActionError(
          "Location access was denied. If your team requires office presence, allow location or switch to remote.",
        );
      }
      submit({ isRemote: false });
    }
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

      {/* "Team today" lives only on the current month — historical months
          show the user's own past entries, not a live presence snapshot. */}
      {isCurrentMonth && <TeamStatusPanel />}

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
            <>
              {/* Mobile: card stack — date + duration as the primary signal,
                  remote/lunch/notes as secondary metadata. */}
              <div className="space-y-3 md:hidden">
                {data.entries.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-border/60 bg-card/40 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                          {e.date}
                        </div>
                        <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
                          {e.durationMinutes !== null
                            ? formatHoursMinutes(e.durationMinutes)
                            : "Active"}
                        </div>
                      </div>
                      {e.isRemote && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Globe className="h-3 w-3" />
                          Remote
                        </span>
                      )}
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm">
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Clock in
                        </dt>
                        <dd className="mt-0.5 font-mono tabular-nums text-foreground">
                          {formatTime(e.clockIn)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Clock out
                        </dt>
                        <dd className="mt-0.5 font-mono tabular-nums text-foreground">
                          {formatTime(e.clockOut)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Lunch
                        </dt>
                        <dd className="mt-0.5 text-foreground">
                          {e.lunchMinutes > 0 ? `${e.lunchMinutes} min` : "—"}
                        </dd>
                      </div>
                      {e.notes && (
                        <div className="col-span-2">
                          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Notes
                          </dt>
                          <dd className="mt-0.5 text-sm text-foreground">{e.notes}</dd>
                        </div>
                      )}
                    </dl>

                    {isAdmin && (
                      <div className="mt-3 flex justify-end border-t border-border/40 pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEditTarget(e)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit entry
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
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
                      {isAdmin && <th className="text-right">Actions</th>}
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
                        {isAdmin && (
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs"
                              onClick={() => setEditTarget(e)}
                              title="Edit attendance"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <EditAttendanceDialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
        entry={editTarget}
      />
    </PageContainer>
  );
}
