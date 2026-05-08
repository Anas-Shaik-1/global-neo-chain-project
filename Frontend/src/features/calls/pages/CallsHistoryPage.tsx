import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Pagination } from "@/components/common/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { useAppSelector } from "@/app/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCallHistory, type CallSession, type CallStatus } from "../api/hooks";
import { useCall, type PeerInfo } from "../CallProvider";
import { NewCallDialog } from "../components/NewCallDialog";
import { PreCallDialog, type PreCallOptions } from "../components/PreCallDialog";

function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusTone(s: CallStatus) {
  switch (s) {
    case "ACTIVE":
      return "info" as const;
    case "ENDED":
      return "default" as const;
    case "INVITED":
      return "warn" as const;
    case "REJECTED":
      return "danger" as const;
    case "MISSED":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function formatDuration(secs: number | null): string {
  if (secs === null) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function formatStartedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CallRow({ call, meId }: { call: CallSession; meId: string | undefined }) {
  const outgoing = call.initiatorId === meId;
  const isGroup = call.kind === "GROUP";
  const otherParticipants = call.participants.filter((p) => p.id !== meId);
  const headlinePeer = otherParticipants[0] ?? call.participants[0];
  const peerLabel = isGroup
    ? otherParticipants.map((p) => p.name).join(", ")
    : headlinePeer?.name ?? "Unknown";

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {isGroup ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ) : (
            <Avatar className="h-8 w-8">
              {headlinePeer?.avatarUrl ? (
                <AvatarImage src={headlinePeer.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-[10px]">
                {initials(headlinePeer?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="font-medium">{peerLabel}</span>
        </div>
      </TableCell>
      <TableCell>
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
          title={outgoing ? "Outgoing" : "Incoming"}
        >
          {outgoing ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownLeft className="h-3.5 w-3.5" />
          )}
          {outgoing ? "Outgoing" : "Incoming"}
          {isGroup && (
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              GROUP
            </span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <StatusBadge tone={statusTone(call.status)}>{call.status}</StatusBadge>
      </TableCell>
      <TableCell className="text-sm">{formatDuration(call.durationSeconds)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatStartedAt(call.startedAt)}
      </TableCell>
    </TableRow>
  );
}

/**
 * Mobile-first card layout for a single call entry. Mirrors the desktop
 * columns: peer identity + status badge at the top, direction + group
 * indicator + duration in the metadata grid, started-at timestamp at the
 * footer.
 */
function CallCard({ call, meId }: { call: CallSession; meId: string | undefined }) {
  const outgoing = call.initiatorId === meId;
  const isGroup = call.kind === "GROUP";
  const otherParticipants = call.participants.filter((p) => p.id !== meId);
  const headlinePeer = otherParticipants[0] ?? call.participants[0];
  const peerLabel = isGroup
    ? otherParticipants.map((p) => p.name).join(", ")
    : headlinePeer?.name ?? "Unknown";

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {isGroup ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <Avatar className="h-10 w-10 shrink-0">
            {headlinePeer?.avatarUrl ? (
              <AvatarImage src={headlinePeer.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-xs font-semibold">
              {initials(headlinePeer?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {peerLabel}
            </span>
            <StatusBadge tone={statusTone(call.status)}>{call.status}</StatusBadge>
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {outgoing ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownLeft className="h-3.5 w-3.5" />
            )}
            {outgoing ? "Outgoing" : "Incoming"}
            {isGroup && (
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                Group
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Duration
          </dt>
          <dd className="mt-0.5 font-mono tabular-nums text-foreground">
            {formatDuration(call.durationSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Started
          </dt>
          <dd className="mt-0.5 text-foreground">{formatStartedAt(call.startedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filtering + stats helpers
// ---------------------------------------------------------------------------

type DirectionFilter = "ALL" | "OUTGOING" | "INCOMING" | "MISSED";

const DIRECTION_FILTERS: { value: DirectionFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "OUTGOING", label: "Outgoing" },
  { value: "INCOMING", label: "Incoming" },
  { value: "MISSED", label: "Missed" },
];

interface CallStats {
  total: number;
  outgoing: number;
  incoming: number;
  missed: number;
  totalSeconds: number;
}

function deriveStats(calls: CallSession[], meId: string | undefined): CallStats {
  let outgoing = 0;
  let incoming = 0;
  let missed = 0;
  let totalSeconds = 0;
  for (const c of calls) {
    if (c.status === "MISSED" || c.status === "REJECTED") {
      missed += 1;
    } else if (c.initiatorId === meId) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
    if (c.durationSeconds && c.status === "ENDED") totalSeconds += c.durationSeconds;
  }
  return { total: calls.length, outgoing, incoming, missed, totalSeconds };
}

function formatTotalTime(secs: number): string {
  if (secs === 0) return "0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: "default" | "primary" | "success" | "danger" | "warn";
}

const TONE_STYLES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "border-border/60",
  primary: "border-primary/40",
  success: "border-emerald-500/30",
  warn: "border-amber-500/30",
  danger: "border-red-500/30",
};

const TONE_ICON: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-red-400",
};

function KpiTile({ label, value, hint, icon, tone = "default" }: KpiTileProps) {
  return (
    <div className={cn("rounded-xl border bg-card/40 p-4", TONE_STYLES[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
            {value}
          </div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40",
            TONE_ICON[tone],
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function DirectionPills({
  value,
  onChange,
  counts,
}: {
  value: DirectionFilter;
  onChange: (next: DirectionFilter) => void;
  counts: Record<DirectionFilter, number>;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter calls by direction"
      className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-card/40 p-1"
    >
      {DIRECTION_FILTERS.map((opt) => {
        const active = opt.value === value;
        const count = counts[opt.value] ?? 0;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{opt.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                active ? "bg-black/15" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function classifyDirection(c: CallSession, meId: string | undefined): DirectionFilter {
  if (c.status === "MISSED" || c.status === "REJECTED") return "MISSED";
  return c.initiatorId === meId ? "OUTGOING" : "INCOMING";
}

export function CallsHistoryPage() {
  const me = useAppSelector((s) => s.auth.user);
  const history = useCallHistory(50);
  const { start } = useCall();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("ALL");
  // Pre-call confirmation: holds the picked peers between NewCallDialog
  // closing and the user confirming mic/cam/screen choices.
  const [pendingPeers, setPendingPeers] = useState<PeerInfo[]>([]);

  const allCalls = history.data ?? [];
  const stats = useMemo(() => deriveStats(allCalls, me?.id), [allCalls, me?.id]);
  const counts: Record<DirectionFilter, number> = {
    ALL: stats.total,
    OUTGOING: stats.outgoing,
    INCOMING: stats.incoming,
    MISSED: stats.missed,
  };

  const filteredCalls = useMemo(() => {
    const t = search.trim().toLowerCase();
    return allCalls.filter((c) => {
      // Direction filter
      if (direction !== "ALL" && classifyDirection(c, me?.id) !== direction) {
        return false;
      }
      // Search
      if (t) {
        const others = c.participants.filter((p) => p.id !== me?.id);
        return others.some((p) => p.name.toLowerCase().includes(t));
      }
      return true;
    });
  }, [allCalls, search, direction, me?.id]);
  const paginated = usePagination(filteredCalls, 10);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Communication · Calls"
        title="Calls"
        description="Recent video calls with your colleagues."
        actions={
          <Button className="gap-2" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" />
            New call
          </Button>
        }
      />

      {/* KPI strip — same pattern as the Expenses page so the rhythm is
          consistent across modules. */}
      {history.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : allCalls.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            label="Total calls"
            value={String(stats.total)}
            hint={formatTotalTime(stats.totalSeconds) + " on calls"}
            icon={<Phone className="h-4 w-4" />}
            tone="primary"
          />
          <KpiTile
            label="Outgoing"
            value={String(stats.outgoing)}
            hint={stats.outgoing === 1 ? "call placed" : "calls placed"}
            icon={<PhoneOutgoing className="h-4 w-4" />}
            tone="success"
          />
          <KpiTile
            label="Incoming"
            value={String(stats.incoming)}
            hint={stats.incoming === 1 ? "call received" : "calls received"}
            icon={<PhoneIncoming className="h-4 w-4" />}
            tone="default"
          />
          <KpiTile
            label="Missed"
            value={String(stats.missed)}
            hint={stats.missed === 0 ? "All clear" : "Worth following up"}
            icon={<PhoneMissed className="h-4 w-4" />}
            tone={stats.missed > 0 ? "danger" : "default"}
          />
        </div>
      ) : null}

      {!history.isLoading && allCalls.length > 0 && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:max-w-md lg:flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Filter calls by peer name…"
              ariaLabel="Search calls"
            />
          </div>
          <DirectionPills value={direction} onChange={setDirection} counts={counts} />
        </div>
      )}

      {history.isLoading ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : allCalls.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Phone className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-foreground">
            No calls yet
          </div>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Start a new call to ring a teammate. Your call history will live
            here so you can see who you spoke with and for how long.
          </p>
          <Button className="mt-4 gap-2" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" />
            Start a call
          </Button>
        </div>
      ) : filteredCalls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
          No calls match this filter.
        </div>
      ) : (
        <>
          {/* Mobile: card stack */}
          <div className="space-y-3 md:hidden">
            {paginated.items.map((c) => (
              <CallCard key={c.id} call={c} meId={me?.id} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peer</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.items.map((c) => (
                  <CallRow key={c.id} call={c} meId={me?.id} />
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={paginated.page}
            pageSize={paginated.pageSize}
            totalPages={paginated.totalPages}
            totalItems={paginated.totalItems}
            onPageChange={paginated.setPage}
            onPageSizeChange={paginated.setPageSize}
          />
        </>
      )}

      <NewCallDialog
        open={showNew}
        onOpenChange={setShowNew}
        meId={me?.id}
        onPick={(peerInfos: PeerInfo[]) => {
          setShowNew(false);
          // Stage the picked peers and let PreCallDialog gather mic/cam/
          // screen choices before the actual `getUserMedia` prompt fires.
          setPendingPeers(peerInfos);
        }}
      />

      <PreCallDialog
        open={pendingPeers.length > 0}
        onOpenChange={(o) => {
          if (!o) setPendingPeers([]);
        }}
        peers={pendingPeers}
        onConfirm={async (opts: PreCallOptions) => {
          const peers = pendingPeers;
          setPendingPeers([]);
          await start(
            peers.map((p) => p.userId),
            peers,
            opts,
          );
        }}
      />
    </PageContainer>
  );
}
