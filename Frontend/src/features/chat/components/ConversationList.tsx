import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";
import type { ChatParticipant, Conversation } from "../api/hooks";

interface Props {
  conversations: Conversation[];
  meId: string | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Render avatar-only rail; labels and previews live in tooltips. */
  collapsed?: boolean;
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
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
            {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt={p.name} /> : null}
            <AvatarFallback className="text-[10px]">{initials(p.name)}</AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
}

export function ConversationList({
  conversations,
  meId,
  selectedId,
  onSelect,
  collapsed = false,
}: Props) {
  // Real presence: online dots on conversation avatars come from the same
  // socket-driven slice that powers the chat header indicator.
  const onlineMap = useAppSelector((s) => s.presence.online);

  if (conversations.length === 0) {
    if (collapsed) {
      return (
        <div className="px-2 py-6 text-center text-xs text-muted-foreground">
          —
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
          <Users className="h-4 w-4" />
        </div>
        <div className="text-sm font-medium text-foreground">
          No conversations yet
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Start a new one above to ping a teammate.
        </div>
      </div>
    );
  }

  return (
    <ul className={cn("flex", collapsed ? "flex-col items-center gap-1 py-2" : "flex-col py-1")}>
      {conversations.map((c) => {
        const active = c.id === selectedId;
        const isGroup = c.kind === "GROUP";
        const other = isGroup ? null : dmOther(c, meId);
        const otherOnline = !!other && Boolean(onlineMap[other.id]);
        const title = isGroup ? c.name ?? "Group" : other?.name ?? "Unknown";
        const subtitle = c.lastMessagePreview ?? "No messages yet";
        // Active conversations are read-by-definition (we mark them on
        // open), so suppress the badge on the row currently selected.
        const unread = active ? 0 : c.unreadCount ?? 0;
        const unreadLabel = unread > 99 ? "99+" : String(unread);

        if (collapsed) {
          return (
            <li key={c.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-label={title}
                    className={cn(
                      // Circular target — matches the round avatar inside,
                      // so the active ring traces the avatar shape instead
                      // of drawing a stray square outline around it.
                      "group relative flex h-10 w-10 items-center justify-center rounded-full outline-none transition-all",
                      "focus-visible:ring-2 focus-visible:ring-primary",
                      active && "ring-2 ring-primary",
                    )}
                  >
                    <div className="relative">
                      {isGroup ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      ) : (
                        <Avatar
                          className={cn(
                            "h-8 w-8 transition-opacity",
                            !active && "group-hover:opacity-90",
                          )}
                        >
                          {other?.avatarUrl ? (
                            <AvatarImage src={other.avatarUrl} alt={other.name} />
                          ) : null}
                          <AvatarFallback className="text-[11px]">
                            {initials(other?.name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!isGroup && otherOnline && (
                        <span
                          aria-hidden
                          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-card bg-emerald-500"
                        />
                      )}
                      {unread > 0 && (
                        <span
                          aria-hidden
                          className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold leading-none text-primary-foreground shadow-[0_0_0_2px_hsl(var(--card))]"
                        >
                          {unreadLabel}
                        </span>
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex max-w-[16rem] flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {title}
                    {unread > 0 && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 font-mono text-[10px] text-primary">
                        {unreadLabel} new
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {subtitle}
                  </span>
                </TooltipContent>
              </Tooltip>
            </li>
          );
        }

        return (
          <li key={c.id} className="px-2">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left outline-none transition-all duration-150",
                "focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? // Active conversation: subtle primary tint, 3px left rail,
                    // bolder text — Cliq/Linear pattern.
                    "bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]"
                  : "hover:bg-accent/60",
              )}
            >
              <div className="relative shrink-0">
                {isGroup ? (
                  <GroupAvatarStack participants={c.participants} />
                ) : (
                  <Avatar className="h-9 w-9">
                    {other?.avatarUrl ? (
                      <AvatarImage src={other.avatarUrl} alt={other.name} />
                    ) : null}
                    <AvatarFallback className="text-xs font-semibold">
                      {initials(other?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                )}
                {!isGroup && otherOnline && (
                  <span
                    aria-label="Online"
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1.5 truncate text-sm",
                      active
                        ? "font-semibold text-foreground"
                        : unread > 0
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground/90",
                    )}
                  >
                    {isGroup && (
                      <Users
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{title}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[10px] tabular-nums",
                      active
                        ? "text-primary/80"
                        : unread > 0
                          ? "text-foreground"
                          : "text-muted-foreground/70",
                    )}
                  >
                    {relativeTime(c.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "min-w-0 truncate text-xs",
                      unread > 0
                        ? "font-medium text-foreground/90"
                        : "text-muted-foreground",
                    )}
                  >
                    {subtitle}
                  </span>
                  {unread > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10px] font-bold leading-none text-primary-foreground">
                      {unreadLabel}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
