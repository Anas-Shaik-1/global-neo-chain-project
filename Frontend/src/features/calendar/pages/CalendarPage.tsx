import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  List,
  Lock,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/common/PageContainer";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/app/hooks";
import {
  useCalendarEvents,
  type CalendarEntry,
} from "../api/hooks";
import { EventDialog } from "../components/EventDialog";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ViewMode = "month" | "week" | "agenda";

/**
 * Filter chips. `all` is the default and overrides every other selection;
 * the rest are independent toggles so a user can, say, view only Reminders
 * within Team-visibility events. Stored as a Set to keep the toggle state
 * cheap to manage across the page.
 */
const FILTER_CHIPS = [
  { key: "mine", label: "Mine" },
  { key: "team", label: "Team" },
  { key: "company", label: "Company" },
  { key: "private", label: "Private" },
  { key: "reminders", label: "Reminders" },
] as const;
type FilterChipKey = (typeof FILTER_CHIPS)[number]["key"];

interface MonthDay {
  /** YYYY-MM-DD */
  key: string;
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  /** Sunday=0…Saturday=6 — used by the today-column highlight in month view. */
  weekday: number;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay()); // back up to Sunday
  return out;
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Generate the 42-cell month grid (6 rows × 7 cols) starting on the Sunday
 * before (or on) the first of the month and ending on the Saturday after
 * the last. Standard month-view layout — keeps every month at a fixed grid
 * size so the page doesn't reflow as the user pages through.
 */
function buildMonthGrid(focus: Date): MonthDay[] {
  const first = startOfMonth(focus);
  const offset = first.getDay(); // 0=Sun
  const today = new Date();
  const cells: MonthDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(1 - offset + i);
    cells.push({
      key: dateKey(d),
      date: d,
      inMonth: d.getMonth() === focus.getMonth(),
      isToday: isSameDay(d, today),
      weekday: d.getDay(),
    });
  }
  return cells;
}

function buildWeekGrid(focus: Date): MonthDay[] {
  const start = startOfWeek(focus);
  const today = new Date();
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      key: dateKey(d),
      date: d,
      inMonth: true,
      isToday: isSameDay(d, today),
      weekday: d.getDay(),
    };
  });
}

function groupByDay(items: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const out = new Map<string, CalendarEntry[]>();
  for (const it of items) {
    // An event can span multiple days — bucket it on each day it intersects.
    const start = new Date(it.start);
    const end = new Date(it.end);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor.getTime() <= last.getTime()) {
      const k = dateKey(cursor);
      const arr = out.get(k) ?? [];
      arr.push(it);
      out.set(k, arr);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  for (const arr of out.values()) {
    arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }
  return out;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Per-kind chip color for the month-grid event pills. Reminders read as
 * the warm "ping me" colour; events as the brand blue.
 */
function chipClass(entry: CalendarEntry): string {
  if (entry.kind === "REMINDER") {
    return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  }
  return "bg-primary/15 text-primary border-primary/30";
}

/**
 * Apply the active filter set to the entries list. `all` means no filter;
 * otherwise an entry must satisfy AT LEAST ONE of the active chips, treating
 * "mine" / visibility chips as one OR group and `reminders` as a kind
 * predicate that combines with AND.
 */
function applyFilters(
  entries: CalendarEntry[],
  filters: Set<FilterChipKey>,
  myId: string | null,
  search: string,
): CalendarEntry[] {
  const needle = search.trim().toLowerCase();
  const wantReminders = filters.has("reminders");
  // Visibility-style chips. If none of the four are picked, we don't
  // narrow by visibility/ownership — only the `reminders` filter (if
  // active) matters.
  const visChips: FilterChipKey[] = ["mine", "team", "company", "private"];
  const activeVis = visChips.filter((k) => filters.has(k));
  const useVis = activeVis.length > 0;

  return entries.filter((e) => {
    if (needle && !e.title.toLowerCase().includes(needle) && !(e.location ?? "").toLowerCase().includes(needle)) {
      return false;
    }
    if (wantReminders && e.kind !== "REMINDER") return false;
    if (!useVis) return true;
    return activeVis.some((k) => {
      if (k === "mine") return myId !== null && e.ownerId === myId;
      return e.visibility === k;
    });
  });
}

export function CalendarPage() {
  const me = useAppSelector((s) => s.auth.user);
  const [view, setView] = useState<ViewMode>("month");
  const [focus, setFocus] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [openEntry, setOpenEntry] = useState<CalendarEntry | null>(null);
  const [creatingForDate, setCreatingForDate] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Set<FilterChipKey>>(() => new Set());
  function toggleFilter(k: FilterChipKey) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  // Range to query depends on view mode. Month view uses the visible 6×7
  // grid window; week view uses just the focused week; agenda is a 60-day
  // window starting from focus, big enough to cover most "what's coming up?"
  // intent without paginating.
  const monthGrid = useMemo(() => buildMonthGrid(focus), [focus]);
  const weekGrid = useMemo(() => buildWeekGrid(focus), [focus]);
  const { fromIso, toIso } = useMemo(() => {
    if (view === "week") {
      const a = startOfWeek(focus);
      const b = endOfWeek(focus);
      return { fromIso: a.toISOString(), toIso: b.toISOString() };
    }
    if (view === "agenda") {
      const a = new Date(focus.getFullYear(), focus.getMonth(), focus.getDate());
      const b = new Date(a);
      b.setDate(b.getDate() + 60);
      b.setHours(23, 59, 59, 999);
      return { fromIso: a.toISOString(), toIso: b.toISOString() };
    }
    const first = monthGrid[0]?.date ?? startOfMonth(focus);
    const last = monthGrid[monthGrid.length - 1]?.date ?? endOfMonth(focus);
    const a = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0);
    const b = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59, 999);
    return { fromIso: a.toISOString(), toIso: b.toISOString() };
  }, [view, focus, monthGrid]);

  const q = useCalendarEvents({ from: fromIso, to: toIso });

  const filtered = useMemo(
    () => applyFilters(q.data ?? [], filters, me?.id ?? null, search),
    [q.data, filters, me?.id, search],
  );

  const byDay = useMemo(() => groupByDay(filtered), [filtered]);

  function shiftPeriod(delta: number) {
    setFocus((f) => {
      if (view === "week") {
        const next = new Date(f);
        next.setDate(next.getDate() + 7 * delta);
        return next;
      }
      if (view === "agenda") {
        const next = new Date(f);
        next.setDate(next.getDate() + 14 * delta);
        return next;
      }
      return new Date(f.getFullYear(), f.getMonth() + delta, 1);
    });
  }

  function gotoToday() {
    const d = new Date();
    if (view === "month") setFocus(new Date(d.getFullYear(), d.getMonth(), 1));
    else setFocus(d);
  }

  function openCreate(forDate: Date | null) {
    setOpenEntry(null);
    setCreatingForDate(forDate);
    setIsOpen(true);
  }

  function openEdit(entry: CalendarEntry) {
    setCreatingForDate(null);
    setOpenEntry(entry);
    setIsOpen(true);
  }

  // Keyboard shortcuts. Bound globally on the page; inputs guard against
  // hijacking by checking `target.tagName` / contentEditable.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (isOpen) return; // dialog has its own scope
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openCreate(null);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        gotoToday();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        shiftPeriod(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shiftPeriod(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, view]);

  const headerTitle = useMemo(() => {
    if (view === "week") {
      const s = startOfWeek(focus);
      const e = endOfWeek(focus);
      const sameMonth = s.getMonth() === e.getMonth();
      const sLabel = s.toLocaleDateString([], { month: "short", day: "numeric" });
      const eLabel = sameMonth
        ? e.toLocaleDateString([], { day: "numeric" })
        : e.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${sLabel} – ${eLabel}, ${e.getFullYear()}`;
    }
    if (view === "agenda") {
      return `Agenda from ${focus.toLocaleDateString([], { month: "short", day: "numeric" })}`;
    }
    return `${MONTH_NAMES[focus.getMonth()]} ${focus.getFullYear()}`;
  }, [view, focus]);

  const filterCount = filters.size + (search.trim().length > 0 ? 1 : 0);

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        eyebrow="Calendar"
        title={headerTitle}
        description="Events you own, you're invited to, and the company-wide calendar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle value={view} onChange={setView} />
            <Button variant="ghost" size="sm" onClick={gotoToday}>
              Today
            </Button>
            <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => shiftPeriod(-1)}
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => shiftPeriod(1)}
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => openCreate(null)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New entry
            </Button>
          </div>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onToggle={toggleFilter}
        onClear={() => {
          setFilters(new Set());
          setSearch("");
        }}
        activeCount={filterCount}
        resultCount={filtered.length}
        totalCount={(q.data ?? []).length}
      />

      {q.isLoading || !q.data ? (
        <Card>
          <CardContent className="p-2 sm:p-3">
            <Skeleton className="h-[28rem] w-full" />
          </CardContent>
        </Card>
      ) : view === "month" ? (
        <Card>
          <CardContent className="p-2 sm:p-3">
            <MonthGrid
              grid={monthGrid}
              byDay={byDay}
              onCreate={(d) => openCreate(d)}
              onOpen={openEdit}
            />
          </CardContent>
        </Card>
      ) : view === "week" ? (
        <Card>
          <CardContent className="p-2 sm:p-3">
            <WeekView
              grid={weekGrid}
              byDay={byDay}
              onCreate={(d) => openCreate(d)}
              onOpen={openEdit}
            />
          </CardContent>
        </Card>
      ) : (
        <AgendaView entries={filtered} onOpen={openEdit} from={focus} />
      )}

      {view === "month" && (
        <UpcomingList
          entries={filtered}
          loading={q.isLoading}
          onOpen={openEdit}
        />
      )}

      <EventDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        entry={openEntry}
        defaultDate={creatingForDate ?? undefined}
      />
    </PageContainer>
  );
}

// ── View toggle ────────────────────────────────────────────────────────────

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const items: { v: ViewMode; label: string; Icon: typeof CalendarDays }[] = [
    { v: "month", label: "Month", Icon: CalendarDays },
    { v: "week", label: "Week", Icon: CalendarRange },
    { v: "agenda", label: "Agenda", Icon: List },
  ];
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="flex items-center gap-0.5 rounded-md border border-border/60 bg-card/40 p-0.5"
    >
      {items.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearchChange,
  filters,
  onToggle,
  onClear,
  activeCount,
  resultCount,
  totalCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  filters: Set<FilterChipKey>;
  onToggle: (k: FilterChipKey) => void;
  onClear: () => void;
  activeCount: number;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search events…"
          className="h-9 pl-8 text-sm"
          aria-label="Search events"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTER_CHIPS.map((c) => {
          const active = filters.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onToggle(c.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        {activeCount > 0 ? (
          <>
            <span className="font-mono tabular-nums">
              {resultCount} / {totalCount}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/40 px-2 py-1 font-medium text-foreground/85 hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </>
        ) : (
          <span className="font-mono tabular-nums">{totalCount} entries</span>
        )}
      </div>
    </div>
  );
}

// ── Month grid ─────────────────────────────────────────────────────────────

function MonthGrid({
  grid,
  byDay,
  onCreate,
  onOpen,
}: {
  grid: MonthDay[];
  byDay: Map<string, CalendarEntry[]>;
  onCreate: (date: Date) => void;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const todayWeekday = useMemo(() => {
    const today = grid.find((c) => c.isToday);
    return today?.weekday ?? -1;
  }, [grid]);

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="grid grid-cols-7 border-b border-border/60 bg-card/40">
        {DAY_NAMES.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
              i === todayWeekday && "text-primary",
            )}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {grid.map((cell) => {
          const items = byDay.get(cell.key) ?? [];
          return (
            <DayCell
              key={cell.key}
              cell={cell}
              entries={items}
              isTodayColumn={cell.weekday === todayWeekday && todayWeekday >= 0}
              onCreate={() => onCreate(cell.date)}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  cell,
  entries,
  isTodayColumn,
  onCreate,
  onOpen,
}: {
  cell: MonthDay;
  entries: CalendarEntry[];
  isTodayColumn: boolean;
  onCreate: () => void;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const visibleCount = 3;
  const overflow = Math.max(0, entries.length - visibleCount);
  const visible = entries.slice(0, visibleCount);
  return (
    <div
      className={cn(
        "group relative flex min-h-[6rem] flex-col gap-1 border-b border-r border-border/60 p-1.5 sm:min-h-[7rem]",
        !cell.inMonth && "bg-card/20 text-muted-foreground/60",
        isTodayColumn && cell.inMonth && "bg-primary/[0.03]",
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCreate}
          className={cn(
            "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums transition-colors",
            cell.isToday
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-foreground/85 hover:bg-accent/40",
          )}
          aria-label={`Add entry on ${cell.date.toDateString()}`}
        >
          {cell.date.getDate()}
        </button>
        {cell.inMonth && (
          <button
            type="button"
            onClick={onCreate}
            aria-label="Add entry"
            className="rounded p-0.5 text-muted-foreground/0 transition-colors hover:bg-accent/40 hover:text-foreground group-hover:text-muted-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {visible.map((entry) => (
          <EventChip key={entry.id} entry={entry} onClick={() => onOpen(entry)} />
        ))}
        {overflow > 0 && (
          <DayOverflowPopover
            entries={entries}
            count={overflow}
            cellDate={cell.date}
            onOpen={onOpen}
          />
        )}
      </div>
    </div>
  );
}

function EventChip({
  entry,
  onClick,
  compact = false,
}: {
  entry: CalendarEntry;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left font-medium",
        compact ? "text-[10px]" : "text-[11px]",
        chipClass(entry),
      )}
      title={entry.title}
    >
      {entry.kind === "REMINDER" ? (
        <Bell className="h-2.5 w-2.5 shrink-0" />
      ) : entry.allDay ? null : (
        <Clock className="h-2.5 w-2.5 shrink-0" />
      )}
      {!entry.allDay && entry.kind !== "REMINDER" && (
        <span className="font-mono tabular-nums opacity-80">
          {formatTime(entry.start)}
        </span>
      )}
      <span className="truncate">{entry.title}</span>
    </button>
  );
}

/**
 * Click-to-expand popover for days with more events than the cell can show.
 * Sits anchored to the cell (same component re-uses click-outside +
 * escape-key dismissal pattern from the landing page nav dropdown).
 */
function DayOverflowPopover({
  entries,
  count,
  cellDate,
  onOpen,
}: {
  entries: CalendarEntry[];
  count: number;
  cellDate: Date;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="px-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
      >
        +{count} more
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-border/80 bg-popover p-1.5 shadow-2xl shadow-black/40">
          <div className="px-1.5 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            {cellDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <div className="flex flex-col gap-0.5">
            {entries.map((e) => (
              <EventChip
                key={e.id}
                entry={e}
                compact
                onClick={() => {
                  setOpen(false);
                  onOpen(e);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Week view ──────────────────────────────────────────────────────────────

function WeekView({
  grid,
  byDay,
  onCreate,
  onOpen,
}: {
  grid: MonthDay[];
  byDay: Map<string, CalendarEntry[]>;
  onCreate: (date: Date) => void;
  onOpen: (entry: CalendarEntry) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <div className="grid grid-cols-7 border-b border-border/60 bg-card/40">
        {grid.map((cell) => (
          <div key={cell.key} className="px-2 py-2 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {DAY_NAMES[cell.weekday]}
            </div>
            <div
              className={cn(
                "mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
                cell.isToday
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/85",
              )}
            >
              {cell.date.getDate()}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-1">
        {grid.map((cell) => {
          const items = byDay.get(cell.key) ?? [];
          return (
            <div
              key={cell.key}
              className={cn(
                "group relative flex min-h-[24rem] flex-col gap-1 border-r border-border/60 p-2",
                cell.isToday && "bg-primary/[0.03]",
              )}
            >
              <button
                type="button"
                onClick={() => onCreate(cell.date)}
                className="absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground/0 transition-colors hover:bg-accent/40 hover:text-foreground group-hover:text-muted-foreground"
                aria-label="Add entry"
              >
                <Plus className="h-3 w-3" />
              </button>
              {items.length === 0 ? (
                <div className="mt-2 text-[11px] text-muted-foreground/60">
                  No events
                </div>
              ) : (
                items.map((entry) => (
                  <EventChip
                    key={entry.id}
                    entry={entry}
                    onClick={() => onOpen(entry)}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agenda view ────────────────────────────────────────────────────────────

function AgendaView({
  entries,
  onOpen,
  from,
}: {
  entries: CalendarEntry[];
  onOpen: (entry: CalendarEntry) => void;
  from: Date;
}) {
  // Group by start-day (just the day the entry begins on, not every day it
  // intersects — agenda is a chronological feed, not a per-day mirror).
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    const sorted = [...entries].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
    for (const e of sorted) {
      const start = new Date(e.start);
      const key = dateKey(start);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([k, items]) => {
      const date = new Date(items[0].start);
      return { key: k, date, items };
    });
  }, [entries]);

  if (grouped.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center pt-10 text-center">
          <CalendarPlus className="mb-3 h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">
            No entries in this window
          </div>
          <div className="mt-1 max-w-sm text-xs text-muted-foreground">
            From {from.toLocaleDateString()} · the next 60 days are empty for
            the active filters.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        {grouped.map((g) => (
          <div key={g.key} className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="sticky top-0 sm:pt-2">
              <div className="font-display text-sm font-semibold tracking-tight text-foreground">
                {g.date.toLocaleDateString([], { weekday: "long" })}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {g.date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <ul className="space-y-1.5">
              {g.items.map((e) => (
                <UpcomingRow key={e.id} entry={e} onOpen={onOpen} />
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Upcoming list (month view tail) ────────────────────────────────────────

function UpcomingList({
  entries,
  loading,
  onOpen,
}: {
  entries: CalendarEntry[];
  loading: boolean;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return entries
      .filter((e) => new Date(e.end).getTime() >= now)
      .slice(0, 8);
  }, [entries]);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (upcoming.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center pt-10 text-center">
          <CalendarPlus className="mb-3 h-6 w-6 text-muted-foreground" />
          <div className="text-sm font-medium text-foreground">No upcoming entries</div>
          <div className="mt-1 max-w-sm text-xs text-muted-foreground">
            Click any day on the grid above, or use "New entry" to add one.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="px-1 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Upcoming
        </div>
        <ul className="space-y-1.5">
          {upcoming.map((e) => (
            <UpcomingRow key={e.id} entry={e} onOpen={onOpen} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function UpcomingRow({
  entry,
  onOpen,
}: {
  entry: CalendarEntry;
  onOpen: (entry: CalendarEntry) => void;
}) {
  const start = new Date(entry.start);
  const dateLabel = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="flex w-full items-start gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-card/60"
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
            entry.kind === "REMINDER"
              ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
              : "border-primary/30 bg-primary/15 text-primary",
          )}
        >
          {entry.kind === "REMINDER" ? (
            <Bell className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {entry.title}
            </span>
            <VisibilityChip visibility={entry.visibility} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {dateLabel}
              {!entry.allDay && entry.kind !== "REMINDER" && (
                <> · {formatTime(entry.start)}–{formatTime(entry.end)}</>
              )}
              {entry.kind === "REMINDER" && <> · {formatTime(entry.start)}</>}
            </span>
            {entry.location && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate">{entry.location}</span>
              </>
            )}
            {entry.attendees.length > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {entry.attendees.length}
                </span>
              </>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function VisibilityChip({ visibility }: { visibility: CalendarEntry["visibility"] }) {
  if (visibility === "private") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Lock className="h-2.5 w-2.5" />
        Private
      </span>
    );
  }
  if (visibility === "company") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
        <Globe className="h-2.5 w-2.5" />
        Company
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      <Users className="h-2.5 w-2.5" />
      Team
    </span>
  );
}

