import { useMemo, useState } from "react";
import { Clock, Globe, Search, UserMinus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  usePresentToday,
  type NotClockedInPerson,
  type PresentTodayPerson,
} from "../api/hooks";

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
 * Combined entry shape used by the "All" tab so the search and rendering
 * code can stay unified instead of branching twice. The discriminator
 * `status` tells the row component which secondary fields are populated.
 */
type CombinedEntry =
  | (PresentTodayPerson & { status: "present" })
  | (NotClockedInPerson & { status: "awaiting" });

/**
 * "Team today" panel — a richer, attendance-page-scoped sibling of the
 * dashboard's PresentTodayCard. This one offers Present/Awaiting/All tabs
 * and a name search so users can find a specific colleague quickly even
 * on a 200-person org. Same data source (usePresentToday) so the lists
 * stay in lockstep with the dashboard widget.
 */
export function TeamStatusPanel() {
  const q = usePresentToday();
  const data = q.data;
  const [tab, setTab] = useState<"present" | "awaiting" | "all">("present");
  const [search, setSearch] = useState("");

  // Dedupe by id at the boundary. Mongo `_id`s should be unique per
  // user, but stale react-query cache or an unmerged migration could
  // briefly surface dupes; with `key={p.id}` in the lists, a duplicate
  // would cause React to render only one row and the visible count would
  // mysteriously be lower than the badge total. Filtering here is cheap
  // (lists are bounded by org size) and keeps the UI honest.
  const dedupeById = <T extends { id: string }>(list: T[]): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  };
  const present = useMemo(
    () => dedupeById(data?.people ?? []),
    [data],
  );
  // Backend might omit notClockedIn on older responses (we kept the field
  // optional in the type for back-compat); also fall back to deriving the
  // list from any embedded "all employees" data if it appears in future.
  const awaiting = useMemo(
    () => dedupeById(data?.notClockedIn ?? []),
    [data],
  );
  const all: CombinedEntry[] = useMemo(() => {
    // If a person somehow appears in both lists (shouldn't happen given
    // the backend filter, but be defensive), prefer the present entry —
    // they're "present" in the more authoritative sense.
    const presentIds = new Set(present.map((p) => p.id));
    const merged: CombinedEntry[] = [
      ...present.map((p) => ({ ...p, status: "present" as const })),
      ...awaiting
        .filter((p) => !presentIds.has(p.id))
        .map((p) => ({ ...p, status: "awaiting" as const })),
    ];
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [present, awaiting]);

  const needle = search.trim().toLowerCase();
  const filterByName = <T extends { name: string }>(list: T[]) =>
    needle.length === 0
      ? list
      : list.filter((p) => p.name.toLowerCase().includes(needle));

  const filteredPresent = useMemo(() => filterByName(present), [present, needle]);
  const filteredAwaiting = useMemo(() => filterByName(awaiting), [awaiting, needle]);
  const filteredAll = useMemo(() => filterByName(all), [all, needle]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-4 w-4 text-muted-foreground" />
              Team today
            </CardTitle>
            {data?.date && (
              <p className="mt-1 text-xs text-muted-foreground">
                Snapshot for {data.date}. Updates every minute.
              </p>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-sm"
              aria-label="Search teammates"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {q.isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="present" className="gap-1.5">
                Present
                <CountBadge active={tab === "present"} value={present.length} />
              </TabsTrigger>
              <TabsTrigger value="awaiting" className="gap-1.5">
                Awaiting
                <CountBadge active={tab === "awaiting"} value={awaiting.length} />
              </TabsTrigger>
              <TabsTrigger value="all" className="gap-1.5">
                All
                <CountBadge active={tab === "all"} value={all.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="present" className="mt-4">
              <PresentList people={filteredPresent} emptyOnSearch={needle.length > 0} />
            </TabsContent>
            <TabsContent value="awaiting" className="mt-4">
              <AwaitingList
                people={filteredAwaiting}
                emptyOnSearch={needle.length > 0}
              />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <CombinedList rows={filteredAll} emptyOnSearch={needle.length > 0} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function CountBadge({ value, active }: { value: number; active: boolean }) {
  // Original implementation used `text-primary-foreground` for the active
  // variant. In our dark theme `--primary-foreground` resolves to a near-
  // black, which on the active tab's already-dark `bg-background` rendered
  // the badge effectively invisible (the user reported the count
  // disappearing on the selected tab). Switching to `foreground/muted`
  // tones keeps the badge legible on both states.
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
        active
          ? "bg-foreground/15 text-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

function EmptyHint({ kind, onSearch }: { kind: "present" | "awaiting" | "all"; onSearch: boolean }) {
  if (onSearch) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No matches.
      </div>
    );
  }
  const [Icon, msg] =
    kind === "present"
      ? [Users, "Nobody's clocked in yet today."]
      : kind === "awaiting"
        ? [UserMinus, "Everyone has clocked in. 🎉"]
        : [Users, "No active teammates on the roster."];
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
      <div className="text-sm font-medium text-foreground">{msg}</div>
    </div>
  );
}

function PresentList({
  people,
  emptyOnSearch,
}: {
  people: PresentTodayPerson[];
  emptyOnSearch: boolean;
}) {
  if (people.length === 0)
    return <EmptyHint kind="present" onSearch={emptyOnSearch} />;
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {people.map((p) => (
        <PresentRow key={p.id} person={p} />
      ))}
    </ul>
  );
}

function AwaitingList({
  people,
  emptyOnSearch,
}: {
  people: NotClockedInPerson[];
  emptyOnSearch: boolean;
}) {
  if (people.length === 0)
    return <EmptyHint kind="awaiting" onSearch={emptyOnSearch} />;
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {people.map((p) => (
        <AwaitingRow key={p.id} person={p} />
      ))}
    </ul>
  );
}

function CombinedList({
  rows,
  emptyOnSearch,
}: {
  rows: CombinedEntry[];
  emptyOnSearch: boolean;
}) {
  if (rows.length === 0) return <EmptyHint kind="all" onSearch={emptyOnSearch} />;
  return (
    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {rows.map((r) =>
        r.status === "present" ? (
          <PresentRow key={`p-${r.id}`} person={r} />
        ) : (
          <AwaitingRow key={`a-${r.id}`} person={r} />
        ),
      )}
    </ul>
  );
}

function PresentRow({ person }: { person: PresentTodayPerson }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md border border-border/40 bg-card/30 px-3 py-2.5",
        person.hasClockedOut && "opacity-60",
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        {person.avatarUrl ? (
          <AvatarImage src={person.avatarUrl} alt={person.name} />
        ) : null}
        <AvatarFallback className="text-xs font-semibold">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {person.name}
          </span>
          <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-label="Present" />
        </div>
        {person.jobTitle && (
          <div className="truncate text-[11px] text-muted-foreground">
            {person.jobTitle}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(person.clockIn)}
        </span>
        <div className="flex items-center gap-1.5">
          {person.isRemote && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <Globe className="h-2.5 w-2.5" />
              Remote
            </span>
          )}
          {person.hasClockedOut && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              done
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function AwaitingRow({ person }: { person: NotClockedInPerson }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border/40 bg-card/20 px-3 py-2.5">
      <Avatar className="h-9 w-9 shrink-0 opacity-75">
        {person.avatarUrl ? (
          <AvatarImage src={person.avatarUrl} alt={person.name} />
        ) : null}
        <AvatarFallback className="text-xs font-semibold">
          {initials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground/85">
            {person.name}
          </span>
          <span
            className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
            aria-label="Not yet clocked in"
          />
        </div>
        {person.jobTitle && (
          <div className="truncate text-[11px] text-muted-foreground">
            {person.jobTitle}
          </div>
        )}
      </div>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        not in
      </span>
    </li>
  );
}
