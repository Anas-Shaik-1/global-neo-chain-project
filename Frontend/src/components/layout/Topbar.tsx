import { useState } from "react";
import { LogOut, Menu, ShieldCheck, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { logoutThunk } from "@/features/auth/authThunks";
import { NotificationsPanel } from "@/features/notifications/NotificationsPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./SidebarNav";

/**
 * Full-width top bar. Hosts the brand on the left and the action cluster
 * (notifications, theme toggle, profile) on the right. Spans the entire
 * viewport above both the Sidebar and the main content area.
 */
export function Topbar() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "??";

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 sm:px-6 lg:px-8">
      {/* Mobile menu trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex h-14 items-center border-b border-border/60 px-4">
            <Link
              to="/"
              className="flex items-center gap-2.5"
              onClick={() => setMobileOpen(false)}
            >
              <img src="/logo.png" alt="" className="h-7 w-7 shrink-0" />
              <span className="font-display text-sm font-semibold tracking-tight">
                Global NeoChain
              </span>
            </Link>
          </div>
          <div className="overflow-y-auto px-3 py-4">
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Brand block — left aligned, compact */}
      <Link
        to="/"
        className="group/brand flex min-w-0 items-center gap-2.5 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <img
          src="/logo.png"
          alt=""
          className="h-7 w-7 shrink-0"
        />
        <span className="truncate font-display text-[15px] font-semibold tracking-tight text-foreground">
          Global NeoChain
        </span>
        <span
          aria-hidden
          className="hidden font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70 sm:inline"
        >
          · EMS
        </span>
      </Link>

      <div className="flex-1" />

      {/* Action cluster */}
      <div className="flex items-center gap-1.5">
        <NotificationsPanel />

        {/* Profile cluster — name + role visible on sm+, avatar always */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-9 gap-2.5 px-1.5 sm:pl-2 sm:pr-2.5"
              aria-label="Account menu"
            >
              <div className="hidden flex-col items-end leading-tight sm:flex">
                <span className="truncate text-[13px] font-semibold text-foreground">
                  {user?.name}
                </span>
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  {user?.role}
                  {user?.isProjectManager ? " · PM" : ""}
                </span>
              </div>
              <Avatar className="h-7 w-7 ring-1 ring-primary/40">
                <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{user?.name}</span>
              <span className="font-mono text-[11px] font-normal text-muted-foreground">
                {user?.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/security">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => dispatch(logoutThunk())}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
