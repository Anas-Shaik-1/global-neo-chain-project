import { NavLink } from "react-router-dom";
import {
  User,
  Users,
  Building2,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  CalendarClock,
  Receipt,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { RoleGate } from "@/features/auth/RoleGate";

const ACTIVE_NAV = [
  { to: "/profile", label: "Profile", Icon: User, roles: undefined as undefined | ("HR" | "ADMIN")[] },
  { to: "/people", label: "People", Icon: Users, roles: undefined },
  { to: "/departments", label: "Departments", Icon: Building2, roles: ["HR", "ADMIN"] as ("HR" | "ADMIN")[] },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock, roles: undefined },
  { to: "/tasks", label: "Tasks", Icon: ListChecks, roles: undefined },
  { to: "/messages", label: "Messages", Icon: MessageSquare, roles: undefined },
  { to: "/expenses", label: "Expenses", Icon: Receipt, roles: undefined },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign, roles: undefined },
];

const STUB_NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
];

const SECTION_LABEL_CLASS =
  "px-3 pb-2 pt-1 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-4 py-5">
        <Logo isClickable showTagline={false} />
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <div className={SECTION_LABEL_CLASS}>Workspace</div>
        {ACTIVE_NAV.map(({ to, label, Icon, roles }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          );
          return roles
            ? <RoleGate key={to} roles={roles}>{link}</RoleGate>
            : link;
        })}
        <div className="pt-4" />
        <div className={SECTION_LABEL_CLASS}>Coming soon</div>
        {STUB_NAV.map(({ to, label, Icon }) => (
          <div
            key={to}
            className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground opacity-50"
            title={`${label} — coming soon`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </div>
        ))}
      </nav>
    </aside>
  );
}
