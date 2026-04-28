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
import { Separator } from "@/components/ui/separator";
import { RoleGate } from "@/features/auth/RoleGate";

const ACTIVE_NAV = [
  { to: "/profile", label: "Profile", Icon: User, roles: undefined as undefined | ("HR" | "ADMIN")[] },
  { to: "/people", label: "People", Icon: Users, roles: undefined },
  { to: "/departments", label: "Departments", Icon: Building2, roles: ["HR", "ADMIN"] as ("HR" | "ADMIN")[] },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock, roles: undefined },
  { to: "/tasks", label: "Tasks", Icon: ListChecks, roles: undefined },
  { to: "/expenses", label: "Expenses", Icon: Receipt, roles: undefined },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign, roles: undefined },
];

const STUB_NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/messages", label: "Messages", Icon: MessageSquare },
];

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-4 py-5">
        <Logo isClickable showTagline={false} />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {ACTIVE_NAV.map(({ to, label, Icon, roles }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
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
        <Separator className="my-2" />
        <div className="px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">Coming soon</div>
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
