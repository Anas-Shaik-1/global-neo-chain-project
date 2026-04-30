import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { sidebarCollapseToggled } from "@/features/ui/uiSlice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./SidebarNav";

export function Sidebar() {
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const dispatch = useAppDispatch();
  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex-1 overflow-y-auto py-5", collapsed ? "px-2" : "px-3")}>
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="border-t border-border/60 p-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => dispatch(sidebarCollapseToggled())}
          className="w-full"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
