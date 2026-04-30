import { useNavigate } from "react-router-dom";
import {
  Bell,
  Receipt,
  FileText,
  ListChecks,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
  type NotificationKind,
} from "./api/hooks";

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  EXPENSE_SUBMITTED: Receipt,
  EXPENSE_APPROVED: CheckCircle2,
  EXPENSE_REJECTED: Receipt,
  PAYSLIP_AVAILABLE: FileText,
  TASK_ASSIGNED: ListChecks,
  EMPLOYEE_VERIFIED: ShieldCheck,
  DEPARTMENT_ASSIGNMENT: Building2,
  PROMOTED_TO_PM: Star,
};

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

function NotificationRow({
  n,
  onClick,
}: {
  n: AppNotification;
  onClick: (n: AppNotification) => void;
}) {
  const Icon = KIND_ICONS[n.kind] ?? Bell;
  const unread = !n.readAt;
  return (
    <button
      type="button"
      onClick={() => onClick(n)}
      className={cn(
        "group flex w-full items-start gap-3 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0",
        unread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/40",
      )}
    >
      <div className="relative pt-0.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground group-hover:text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        {unread && (
          <span
            aria-hidden
            className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--card))]"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium text-foreground/90")}>
            {n.title}
          </div>
          <div className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {relativeTime(n.createdAt)}
          </div>
        </div>
        {n.body && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
        )}
      </div>
    </button>
  );
}

export function NotificationsPanel() {
  const navigate = useNavigate();
  const list = useNotifications({ limit: 20 });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const items = list.data?.items ?? [];
  const unreadCount = unread.data?.count ?? 0;
  const hasUnread = unreadCount > 0;
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  function handleClick(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            hasUnread
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold leading-none text-primary-foreground shadow-sm"
            >
              {badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[22rem] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <div className="text-sm font-semibold tracking-tight">Notifications</div>
          {hasUnread && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-muted-foreground">
                <Bell className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium text-foreground">No notifications</div>
              <div className="mt-0.5 text-xs text-muted-foreground">You're all caught up.</div>
            </div>
          ) : (
            items.map((n) => (
              <NotificationRow key={n.id} n={n} onClick={handleClick} />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
