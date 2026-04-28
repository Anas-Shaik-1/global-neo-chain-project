import { NavLink } from "react-router-dom";
import {
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

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/messages", label: "Messages", Icon: MessageSquare },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock },
  { to: "/expenses", label: "Expenses", Icon: Receipt },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign },
];

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-4 py-5">
        <Logo isClickable showTagline={false} />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ to, label, Icon }) => (
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
        ))}
      </nav>
    </aside>
  );
}
