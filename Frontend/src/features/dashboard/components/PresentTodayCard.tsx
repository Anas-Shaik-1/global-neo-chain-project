import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronDown, Clock, Globe, UserMinus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  usePresentToday,
  type NotClockedInPerson,
  type PresentTodayPerson,
} from "@/features/attendance/api/hooks";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * "Who's in today" widget — one card on every role's dashboard. Shows the
 * count + a vertical list of present employees with their avatar, name,
 * clock-in time, and remote/onsite chip. Updates every 60s so arrivals
 * roll in without a manual refresh.
 *
 * This is presence-positive: it answers "who's around right now?" rather
 * than calling out absences. The "X yet to clock in" line is muted footer
 * text — useful but not framed as a public list of who's missing.
 */
export function PresentTodayCard() {
  const q = usePresentToday();
  const data = q.data;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg">Present today</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Updated every minute. {data?.date && `For ${data.date}.`}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link to="/attendance">Attendance →</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
        {q.isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <PresenceMetrics
              presentCount={data.presentCount}
              remoteCount={data.remoteCount}
            />
            {data.people.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center">
                <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <div className="text-sm font-medium text-foreground">
                  Nobody's clocked in yet
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Be the first — head to Attendance and clock in.
                </div>
              </div>
            ) : (
              <ul className="min-h-[8rem] flex-1 space-y-1.5 overflow-y-auto pr-1">
                {data.people.map((p) => (
                  <PresentRow key={p.id} person={p} />
                ))}
              </ul>
            )}
            <NotClockedInPanel notClockedIn={data.notClockedIn ?? []} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Collapsible "Awaiting clock-in" panel — shows the names + avatars of
 * teammates who haven't started their day yet. Defaults to closed because
 * for an active org of any size this list is the longer one; users opt in
 * when they actually want to know who's missing. Uses muted tones so the
 * present-today list still reads as the primary content.
 */
function NotClockedInPanel({
  notClockedIn,
}: {
  notClockedIn: NotClockedInPerson[];
}) {
  const [open, setOpen] = useState(false);
  if (notClockedIn.length === 0) return null;
  const count = notClockedIn.length;
  return (
    <div className="rounded-md border border-border/40 bg-card/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-card/40"
      >
        <div className="flex items-center gap-2">
          <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Awaiting clock-in
          </span>
          <span className="rounded-full bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {count}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul className="max-h-[18rem] space-y-1 overflow-y-auto border-t border-border/40 px-2 py-2">
          {notClockedIn.map((p) => (
            <NotClockedInRow key={p.id} person={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotClockedInRow({ person }: { person: NotClockedInPerson }) {
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5">
      <Avatar className="h-7 w-7 shrink-0 opacity-80">
        {person.avatarUrl ? (
          <AvatarImage src={person.avatarUrl} alt={person.name} />
        ) : null}
        <AvatarFallback className="text-[10px] font-semibold">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-foreground/85">
          {person.name}
        </div>
        {person.jobTitle && (
          <div className="truncate text-[10px] text-muted-foreground">
            {person.jobTitle}
          </div>
        )}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        not in
      </span>
    </li>
  );
}

function PresenceMetrics({
  presentCount,
  remoteCount,
}: {
  presentCount: number;
  remoteCount: number;
}) {
  const onsiteCount = Math.max(0, presentCount - remoteCount);
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Present" value={presentCount} tone="primary" Icon={CheckCircle2} />
      <Stat label="Onsite" value={onsiteCount} tone="default" Icon={Users} />
      <Stat label="Remote" value={remoteCount} tone="default" Icon={Globe} />
      {/* The "Awaiting clock-in" panel below the present roster carries
          this information now — including the names. We keep the strip
          purely for the three present-side counts. */}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: number;
  tone: "primary" | "default";
  Icon: typeof CheckCircle2;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card/40 px-3 py-2.5",
        tone === "primary" ? "border-primary/30" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "primary" ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function PresentRow({ person }: { person: PresentTodayPerson }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border border-border/40 bg-card/30 px-3 py-2",
        person.hasClockedOut && "opacity-60",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {person.avatarUrl ? (
          <AvatarImage src={person.avatarUrl} alt={person.name} />
        ) : null}
        <AvatarFallback className="text-[11px] font-semibold">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {person.name}
        </div>
        {person.jobTitle && (
          <div className="truncate text-[11px] text-muted-foreground">
            {person.jobTitle}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {person.isRemote && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Globe className="h-3 w-3" />
            Remote
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(person.clockIn)}
        </span>
        {person.hasClockedOut && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            done
          </span>
        )}
      </div>
    </li>
  );
}
