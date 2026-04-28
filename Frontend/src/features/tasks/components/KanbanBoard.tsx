import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Task, TaskStatus, TaskPriority } from "../api/hooks";

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

function priorityClasses(priority: TaskPriority): string {
  switch (priority) {
    case "HIGH":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "MEDIUM":
      return "bg-accent text-accent-foreground border-border";
    case "LOW":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDueDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const due = formatDueDate(task.dueDate);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</span>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            priorityClasses(task.priority),
          )}
        >
          {task.priority}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px]">{initialsOf(task.assigneeName)}</AvatarFallback>
        </Avatar>
        {due && <span className="text-xs text-muted-foreground">{due}</span>}
      </div>
    </button>
  );
}

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onColumnAdd?: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onCardClick, onColumnAdd }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div key={col.id} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">
                {col.label}
                <span className="ml-2 text-xs text-muted-foreground">{columnTasks.length}</span>
              </div>
              {onColumnAdd && (
                <button
                  type="button"
                  onClick={() => onColumnAdd(col.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  aria-label={`Add task to ${col.label}`}
                >
                  + New
                </button>
              )}
            </div>
            <div className="space-y-2">
              {columnTasks.map((t) => (
                <TaskCard key={t.id} task={t} onClick={() => onCardClick(t)} />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
