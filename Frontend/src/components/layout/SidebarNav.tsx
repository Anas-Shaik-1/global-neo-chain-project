import { NavLink } from "react-router-dom";
import {
  Users,
  UserCheck,
  Building2,
  Bug,
  CalendarDays,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Phone,
  CalendarClock,
  Receipt,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RoleGate } from "@/features/auth/RoleGate";
import { useChatUnreadTotal } from "@/features/chat/api/hooks";

type Role = "ADMIN" | "HR" | "EMPLOYEE";

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  roles?: Role[];
  /** Identifier for runtime badge data (e.g. unread message count). */
  badgeKind?: "messages";
}

/**
 * Flat sidebar nav. Items ordered by daily-use frequency: clock-in actions
 * first, then collaborative work, then admin/finance, then org management.
 * Profile lives in the Topbar account dropdown so it doesn't compete here.
 */
const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock },
  { to: "/calendar", label: "Calendar", Icon: CalendarDays },
  { to: "/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/messages", label: "Messages", Icon: MessageSquare, badgeKind: "messages" },
  { to: "/calls", label: "Calls", Icon: Phone },
  { to: "/expenses", label: "Expenses", Icon: Receipt },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign },
  { to: "/people", label: "People", Icon: Users },
  { to: "/people/candidates", label: "Candidates", Icon: UserCheck, roles: ["HR", "ADMIN"] },
  { to: "/departments", label: "Departments", Icon: Building2, roles: ["HR", "ADMIN"] },
  // Bugs is visible to everyone — anyone can file, the reporter or an
  // ADMIN can edit. Useful for any teammate who runs into a regression.
  { to: "/bugs", label: "Bugs", Icon: Bug },
  // Feedback channel: any employee can post a suggestion or complaint
  // (optionally anonymous). HR + Admin triage from the same screen.
  { to: "/feedback", label: "Feedback", Icon: Lightbulb },
];

interface Props {
  /** Fired on link click so the mobile drawer can close itself. */
  onNavigate?: () => void;
  /** Render icon-only with tooltips. */
  collapsed?: boolean;
  className?: string;
}

/**
 * Active-state styling lives on the outer NavLink and is propagated to inner
 * elements via Tailwind's `aria-[current=page]` and `group-aria-[current=page]`
 * modifiers. React Router automatically stamps `aria-current="page"` on the
 * matching link, so we get the active state for free without any render-prop
 * gymnastics.
 */
const linkBase = cn(
  "group flex items-center rounded-md text-sm font-medium outline-none transition-colors",
  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
  // Idle state
  "text-muted-foreground hover:bg-accent hover:text-foreground",
  // Active state (NavLink applies aria-current="page")
  "aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:shadow-sm",
);

export function SidebarNav({ onNavigate, collapsed = false, className }: Props) {
  // Single subscription used to drive any nav item that carries `badgeKind`.
  // Currently only Messages, but keyed by kind so future ones (calls, tasks)
  // slot in without re-plumbing.
  const chatUnread = useChatUnreadTotal();
  const messageCount = chatUnread.data?.count ?? 0;

  return (
    <nav className={className}>
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ to, label, Icon, roles, badgeKind }) => {
          const badgeCount = badgeKind === "messages" ? messageCount : 0;
          // Items whose path is a *prefix* of another nav item's path need
          // `end={true}` so they don't light up alongside the child route.
          // Without this, `/people` matches `/people/candidates` and both
          // entries activate together.
          const hasChildInNav = NAV_ITEMS.some(
            (other) => other.to !== to && other.to.startsWith(`${to}/`),
          );
          const link = (
            <NavLink
              to={to}
              onClick={onNavigate}
              end={hasChildInNav || to === "/dashboard"}
              aria-label={collapsed ? label : undefined}
              className={cn(
                linkBase,
                collapsed
                  ? "mx-auto h-11 w-11 justify-center"
                  : "h-11 w-full gap-3 px-3",
              )}
            >
              {collapsed ? (
                // Bare icon centered in the 44-px button. Active state on the
                // wrapping NavLink turns the whole button cyan, making the
                // current page unmistakable in icon-only mode.
                <span className="relative">
                  <Icon className="h-5 w-5 shrink-0 transition-colors" />
                  {badgeCount > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold leading-none text-primary-foreground shadow-[0_0_0_2px_hsl(var(--background))] group-aria-[current=page]:bg-primary-foreground group-aria-[current=page]:text-primary"
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </span>
              ) : (
                // Expanded mode keeps the Linear-style icon-tile inset:
                // a slightly darker rounded square around the icon when
                // active, drawn via the `group-aria-[current=page]:` modifier.
                <>
                  <span
                    className={cn(
                      "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                      "group-aria-[current=page]:bg-black/15",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {badgeCount > 0 && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[8px] font-bold leading-none text-primary-foreground shadow-[0_0_0_2px_hsl(var(--background))]"
                      />
                    )}
                  </span>
                  <span className="truncate">{label}</span>
                  {badgeCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[10px] font-bold leading-none text-primary-foreground group-aria-[current=page]:bg-primary-foreground group-aria-[current=page]:text-primary">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );

          const wrapped = collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {label}
              </TooltipContent>
            </Tooltip>
          ) : (
            link
          );

          return (
            <li key={to}>
              {roles ? <RoleGate roles={roles}>{wrapped}</RoleGate> : wrapped}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
