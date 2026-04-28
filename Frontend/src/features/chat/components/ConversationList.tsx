import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Conversation } from "../api/hooks";

interface Props {
  conversations: Conversation[];
  meId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function otherParticipant(c: Conversation, meId: string | undefined) {
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
        const other = otherParticipant(c, meId);
        const active = c.id === selectedId;
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
              <Avatar className="h-9 w-9 shrink-0">
                {other?.avatarUrl ? (
                  <AvatarImage src={other.avatarUrl} alt={other.name} />
                ) : null}
                <AvatarFallback>{initials(other?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {other?.name ?? "Unknown"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.lastMessagePreview ?? "No messages yet"}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
