import { NavLink } from "react-router-dom";
import {
  User,
  Users,
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
import { RoleGate } from "@/features/auth/RoleGate";

const ACTIVE_NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, roles: undefined as undefined | ("HR" | "ADMIN")[] },
  { to: "/profile", label: "Profile", Icon: User, roles: undefined },
  { to: "/people", label: "People", Icon: Users, roles: undefined },
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

const navItemClass = (isActive: boolean) =>
  cn(
    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
    isActive
      ? "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r before:bg-primary"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
        <div className={SECTION_LABEL_CLASS}>Workspace</div>
        {ACTIVE_NAV.map(({ to, label, Icon, roles }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => navItemClass(isActive)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          );
          return roles
            ? <RoleGate key={to} roles={roles}>{link}</RoleGate>
            : link;
        })}
        {STUB_NAV.length > 0 && (
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
      </nav>
    </aside>
  );
}
