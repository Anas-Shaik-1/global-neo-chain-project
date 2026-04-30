import { NavLink } from "react-router-dom";
import {
  User,
  Users,
  UserCheck,
  Building2,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Phone,
  CalendarClock,
  Receipt,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RoleGate } from "@/features/auth/RoleGate";

const ACTIVE_NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, roles: undefined as undefined | ("HR" | "ADMIN")[] },
  { to: "/profile", label: "Profile", Icon: User, roles: undefined },
  { to: "/people", label: "People", Icon: Users, roles: undefined },
  { to: "/people/candidates", label: "Candidates", Icon: UserCheck, roles: ["HR", "ADMIN"] as ("HR" | "ADMIN")[] },
  { to: "/departments", label: "Departments", Icon: Building2, roles: ["HR", "ADMIN"] as ("HR" | "ADMIN")[] },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock, roles: undefined },
  { to: "/tasks", label: "Tasks", Icon: ListChecks, roles: undefined },
  { to: "/messages", label: "Messages", Icon: MessageSquare, roles: undefined },
  { to: "/calls", label: "Calls", Icon: Phone, roles: undefined },
  { to: "/expenses", label: "Expenses", Icon: Receipt, roles: undefined },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign, roles: undefined },
];

const STUB_NAV: { to: string; label: string; Icon: typeof LayoutDashboard }[] = [];

const SECTION_LABEL_CLASS =
  "px-3 pb-1.5 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60";

const navItemClass = (isActive: boolean, collapsed: boolean) =>
  cn(
    "relative flex items-center rounded-md text-sm font-medium transition-all",
    collapsed
      ? "h-10 w-10 justify-center"
      : "gap-3 px-3 py-2",
    isActive
      ? "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-primary"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

interface Props {
  /**
   * Optional callback fired when a nav link is clicked. The mobile drawer
   * passes this so the sheet can close itself on navigation.
   */
  onNavigate?: () => void;
  className?: string;
  /**
   * When true, render icon-only items with tooltips. Passed by the desktop
   * `<Sidebar>`; the mobile drawer always passes `false` because tooltips on
   * a touch device feel wrong (they'd need a long-press to reveal).
   */
  collapsed?: boolean;
}

/**
 * Single source of truth for the sidebar nav items. Rendered both inside the
 * desktop {@link Sidebar} `<aside>` and inside the mobile `<Sheet>` drawer
 * triggered from {@link Topbar}.
 */
export function SidebarNav({ onNavigate, className, collapsed = false }: Props) {
  return (
    <nav className={cn(collapsed ? "flex flex-col items-center gap-1" : "space-y-0.5", className)}>
      {!collapsed && <div className={SECTION_LABEL_CLASS}>Workspace</div>}
      {ACTIVE_NAV.map(({ to, label, Icon, roles }) => {
        const inner = (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => navItemClass(isActive, collapsed)}
            aria-label={collapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
          </NavLink>
        );
        const link = collapsed ? (
          <Tooltip key={to}>
            <TooltipTrigger asChild>{inner}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ) : (
          inner
        );
        return roles
          ? <RoleGate key={to} roles={roles}>{link}</RoleGate>
          : link;
      })}
      {STUB_NAV.length > 0 && !collapsed && (
        <>
          <Separator className="my-3" />
          <div className={SECTION_LABEL_CLASS}>Coming soon</div>
          {STUB_NAV.map(({ to, label, Icon }) => (
            <div
              key={to}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60"
              title={`${label} — coming soon`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              <span className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Soon
              </span>
            </div>
          ))}
        </>
      )}
      {STUB_NAV.length > 0 && collapsed && (
        STUB_NAV.map(({ to, label, Icon }) => (
          <Tooltip key={to}>
            <TooltipTrigger asChild>
              <div
                className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
                aria-label={`${label} (coming soon)`}
              >
                <Icon className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{label} · soon</TooltipContent>
          </Tooltip>
        ))
      )}
    </nav>
  );
}
