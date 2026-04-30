import { SidebarNav } from "./SidebarNav";

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <SidebarNav />
      </div>
    </aside>
  );
}
