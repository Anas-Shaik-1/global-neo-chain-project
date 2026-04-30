import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ChatParticipant, Conversation } from "../api/hooks";

interface Props {
  conversations: Conversation[];
  meId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function dmOther(c: Conversation, meId: string | undefined): ChatParticipant | undefined {
  if (!meId) return c.participants[0];
  return c.participants.find((p) => p.id !== meId) ?? c.participants[0];
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

interface GroupAvatarStackProps {
  participants: ChatParticipant[];
}

function GroupAvatarStack({ participants }: GroupAvatarStackProps) {
  const visible = participants.slice(0, 3);
  const overflow = Math.max(0, participants.length - 3);
  const hasOverflow = overflow > 0;
  // We render up to 3 avatars overlapping. If there's overflow, the third
  // slot becomes a "+N" tile instead of a face.
  return (
    <div className="relative h-9 w-9 shrink-0">
      {visible.map((p, idx) => {
        const isThirdAndOverflow = hasOverflow && idx === 2;
        const left = idx * 8;
        const top = idx * 4;
        if (isThirdAndOverflow) {
          return (
            <div
              key={`overflow-${p.id}`}
              className="absolute flex h-6 w-6 items-center justify-center rounded-full border border-card bg-muted text-[10px] font-medium text-foreground"
              style={{ left, top }}
              aria-label={`${overflow + 1} more members`}
            >
              +{overflow + 1}
            </div>
          );
        }
        return (
          <Avatar
            key={p.id}
            className="absolute h-6 w-6 border border-card"
            style={{ left, top }}
          >
            {p.avatarUrl ? (
              <AvatarImage src={p.avatarUrl} alt={p.name} />
            ) : null}
            <AvatarFallback className="text-[10px]">{initials(p.name)}</AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

export function ConversationList({ conversations, meId, selectedId, onSelect }: Props) {
  if (conversations.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No conversations yet. Start a new one above.
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {conversations.map((c) => {
        const active = c.id === selectedId;
        const isGroup = c.kind === "GROUP";
        const other = isGroup ? null : dmOther(c, meId);
        const title = isGroup
          ? c.name ?? "Group"
          : other?.name ?? "Unknown";
        const subtitle = c.lastMessagePreview ?? "No messages yet";

        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent/50",
                active && "bg-accent",
              )}
            >
              {isGroup ? (
                <GroupAvatarStack participants={c.participants} />
              ) : (
                <Avatar className="h-9 w-9 shrink-0">
                  {other?.avatarUrl ? (
                    <AvatarImage src={other.avatarUrl} alt={other.name} />
                  ) : null}
                  <AvatarFallback>{initials(other?.name ?? "?")}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                    {isGroup && (
                      <Users
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
