import { Menu } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { sidebarCollapseToggled } from "@/features/ui/uiSlice";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./SidebarNav";

/**
 * Desktop app sidebar — sits below the full-width Topbar.
 *
 * Width:
 *   • expanded:  240px (w-60)
 *   • collapsed:  72px (w-[72px])
 *
 * Structure:
 *   ┌────────────────────────┐
 *   │ Section title + ≡ btn  │  h-14 / 56  (collapse trigger lives here)
 *   ├────────────────────────┤
 *   │ Flat nav               │  flex-1 overflow-y-auto
 *   └────────────────────────┘
 *
 * Brand and user are no longer in the sidebar — both live in the Topbar.
 */
export function Sidebar() {
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const dispatch = useAppDispatch();

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-border/60 bg-card transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      {/* Section header + collapse toggle */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border/60",
          collapsed ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        {!collapsed && (
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">
            Workspace
          </span>
        )}
        <button
          type="button"
          onClick={() => dispatch(sidebarCollapseToggled())}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Flat nav — only scroll surface inside the sidebar */}
      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          collapsed ? "px-2 py-4" : "px-3 py-4",
        )}
      >
        <SidebarNav collapsed={collapsed} />
      </div>
    </aside>
  );
}
