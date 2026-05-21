import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import {
  Users,
  UserCheck,
  Building2,
  Bug,
  CalendarDays,
  CalendarOff,
  FileText,
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

interface NavSection {
  /** Optional uppercase section label rendered above the group. */
  title?: string;
  items: NavItem[];
}

/**
 * Sectioned sidebar nav. Items are grouped by responsibility so the
 * sidebar reads as a roadmap rather than a wall of links. Section
 * labels appear only when expanded; in collapsed mode the sections are
 * separated by a faint hairline divider instead.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    ],
  },
  {
    title: "Workspace",
    items: [
      { to: "/tasks", label: "Tasks", Icon: ListChecks },
      { to: "/calendar", label: "Calendar", Icon: CalendarDays },
      { to: "/messages", label: "Messages", Icon: MessageSquare, badgeKind: "messages" },
      { to: "/calls", label: "Calls", Icon: Phone },
    ],
  },
  {
    title: "Time & Pay",
    items: [
      { to: "/attendance", label: "Attendance", Icon: CalendarClock },
      { to: "/leaves", label: "Leaves", Icon: CalendarOff },
      { to: "/expenses", label: "Expenses", Icon: Receipt },
      { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign },
    ],
  },
  {
    title: "Organisation",
    items: [
      { to: "/people", label: "People", Icon: Users },
      { to: "/people/candidates", label: "Candidates", Icon: UserCheck, roles: ["HR", "ADMIN"] },
      { to: "/departments", label: "Departments", Icon: Building2, roles: ["HR", "ADMIN"] },
    ],
  },
  {
    title: "More",
    items: [
      { to: "/resume", label: "Resume", Icon: FileText },
      { to: "/bugs", label: "Bugs", Icon: Bug },
      { to: "/feedback", label: "Feedback", Icon: Lightbulb },
    ],
  },
];

// Flat list used for prefix checks (e.g. /people vs /people/candidates).
const FLAT_NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

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
  "group flex items-center rounded-md text-[13px] font-medium outline-none transition-colors",
  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
  // Idle state
  "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  // Active state (NavLink applies aria-current="page")
  "aria-[current=page]:bg-primary/15 aria-[current=page]:text-primary",
);

export function SidebarNav({ onNavigate, collapsed = false, className }: Props) {
  // Single subscription used to drive any nav item that carries `badgeKind`.
  // Currently only Messages, but keyed by kind so future ones (calls, tasks)
  // slot in without re-plumbing.
  const chatUnread = useChatUnreadTotal();
  const messageCount = chatUnread.data?.count ?? 0;

  function renderItem({ to, label, Icon, roles, badgeKind }: NavItem) {
    const badgeCount = badgeKind === "messages" ? messageCount : 0;
    // Items whose path is a *prefix* of another nav item's path need
    // `end={true}` so they don't light up alongside the child route.
    const hasChildInNav = FLAT_NAV.some(
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
            ? "mx-auto h-10 w-10 justify-center"
            : "h-9 w-full gap-2.5 px-2.5",
        )}
      >
        {collapsed ? (
          <span className="relative">
            <Icon className="h-[18px] w-[18px] shrink-0 transition-colors" />
            {badgeCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold leading-none text-primary-foreground shadow-[0_0_0_2px_hsl(var(--card))]"
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </span>
        ) : (
          <>
            <Icon className="h-[16px] w-[16px] shrink-0" />
            <span className="truncate">{label}</span>
            {badgeCount > 0 && (
              <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary/20 px-1.5 font-mono text-[10px] font-semibold leading-none text-primary">
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
  }

  return (
    <nav className={className}>
      {NAV_SECTIONS.map((section, idx) => {
        const showSeparator = collapsed && idx > 0;
        return (
          <Fragment key={section.title ?? `section-${idx}`}>
            {showSeparator && (
              <div className="mx-3 my-2 border-t border-border/40" aria-hidden />
            )}
            {!collapsed && section.title && (
              <div className="mb-1.5 mt-4 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 first:mt-0">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">{section.items.map(renderItem)}</ul>
          </Fragment>
        );
      })}
    </nav>
  );
}
