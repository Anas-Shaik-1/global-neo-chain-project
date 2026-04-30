import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import { StatusBadge } from "@/components/common/StatusBadge";
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

export function CallsHistoryPage() {
  const me = useAppSelector((s) => s.auth.user);
  const history = useCallHistory(50);
  const { start } = useCall();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");

  const filteredCalls = useMemo(() => {
    const all = history.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return all;
    return all.filter((c) => {
      const others = c.participants.filter((p) => p.id !== me?.id);
      return others.some((p) => p.name.toLowerCase().includes(t));
    });
  }, [history.data, search, me?.id]);

  return (
    <PageContainer width="default" className="space-y-6">
      <PageHeader
        title="Calls"
        description="Recent video calls with your colleagues."
        actions={
          <Button className="gap-2" onClick={() => setShowNew(true)}>
            <Phone className="h-4 w-4" />
            New call
          </Button>
        }
      />

      {!history.isLoading && (history.data ?? []).length > 0 && (
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Filter calls by peer name…"
          ariaLabel="Search calls"
          className="max-w-md"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {history.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (history.data ?? []).length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No calls yet. Start a new call to ring a teammate.
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No calls match your search.
          </div>
        ) : (
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
              {filteredCalls.map((c) => (
                <CallRow key={c.id} call={c} meId={me?.id} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <NewCallDialog
        open={showNew}
        onOpenChange={setShowNew}
        meId={me?.id}
        onPick={(peerInfos: PeerInfo[]) => {
          setShowNew(false);
          void start(
            peerInfos.map((p) => p.userId),
            peerInfos,
          );
        }}
      />
    </PageContainer>
  );
}
