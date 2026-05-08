import { useState } from "react";
import { LogOut, Menu, Moon, ShieldCheck, Sun, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { themeChanged } from "@/features/ui/uiSlice";
import { logoutThunk } from "@/features/auth/authThunks";
import { NotificationsPanel } from "@/features/notifications/NotificationsPanel";
import { cn } from "@/lib/utils";
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
  const theme = useAppSelector((s) => s.ui.theme);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "??";

  return (
    <header className="relative z-30 flex h-20 shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4 sm:px-6 lg:px-8">
      {/* Mobile menu trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex h-16 items-center border-b border-border/60 px-4">
            <Link
              to="/"
              className="flex items-center gap-3"
              onClick={() => setMobileOpen(false)}
            >
              <img src="/logo.png" alt="" className="h-8 w-8 shrink-0" />
              <span className="font-display text-base font-semibold tracking-tight">
                Global NeoChain
              </span>
            </Link>
          </div>
          <div className="overflow-y-auto px-3 py-4">
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Brand block — left aligned */}
      <Link
        to="/"
        className="flex min-w-0 items-center gap-3 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <img
          src="/logo.png"
          alt=""
          className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"
        />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-xl font-bold tracking-tight text-primary sm:text-2xl">
            Global NeoChain
          </span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">
            Employee Management System · Indonesian professionals
          </span>
        </div>
      </Link>

      <div className="flex-1" />

      {/* Action cluster */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => dispatch(themeChanged(theme === "dark" ? "light" : "dark"))}
          className="relative"
        >
          <Sun
            className={cn(
              "h-4 w-4 transition-all duration-300",
              theme === "dark" ? "scale-100 rotate-0" : "scale-0 -rotate-90",
            )}
          />
          <Moon
            className={cn(
              "absolute h-4 w-4 transition-all duration-300",
              theme === "dark" ? "scale-0 rotate-90" : "scale-100 rotate-0",
            )}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <NotificationsPanel />

        {/* Profile cluster — name + role visible on sm+, avatar always */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-12 gap-3 px-2 sm:px-3"
              aria-label="Account menu"
            >
              <div className="hidden flex-col items-end leading-tight sm:flex">
                <span className="truncate text-sm font-semibold text-foreground">
                  {user?.name}
                </span>
                <span className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                  {user?.role}
                  {user?.isProjectManager ? " · PM" : ""}
                </span>
              </div>
              <Avatar className="h-9 w-9 ring-2 ring-primary/40">
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
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
