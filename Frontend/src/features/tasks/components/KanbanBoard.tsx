import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubtasks, type Task, type TaskStatus, type TaskPriority } from "../api/hooks";

const COLUMNS: { id: TaskStatus; label: string; dot: string }[] = [
  { id: "TODO", label: "To do", dot: "bg-muted-foreground/60" },
  { id: "IN_PROGRESS", label: "In progress", dot: "bg-amber-400" },
  { id: "DONE", label: "Done", dot: "bg-emerald-400" },
];

function priorityChipClasses(priority: TaskPriority): string {
  switch (priority) {
    case "HIGH":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "MEDIUM":
      return "bg-primary/15 text-primary border-primary/30";
    case "ENHANCEMENT":
      // Enhancement is non-urgent product polish — distinct violet so it
      // doesn't read as a bug-fix priority alongside HIGH/MEDIUM/LOW.
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "LOW":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function priorityStripClasses(priority: TaskPriority): string {
  switch (priority) {
    case "HIGH":
      return "bg-destructive";
    case "MEDIUM":
      return "bg-primary";
    case "ENHANCEMENT":
      return "bg-violet-500";
    case "LOW":
    default:
      return "bg-muted-foreground/30";
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

interface DraggableTaskCardProps {
  task: Task;
  onClick: () => void;
  onSubtaskClick?: (subtask: Task) => void;
}

function DraggableTaskCard({ task, onClick, onSubtaskClick }: DraggableTaskCardProps) {
  const due = formatDueDate(task.dueDate);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  // Subtasks are fetched lazily — the kanban renders dozens of cards, so
  // we don't want to query subtasks for every parent up-front. The hook
  // is gated by `enabled` (see useSubtasks signature) once expanded.
  const [expanded, setExpanded] = useState(false);
  const subtasks = useSubtasks(expanded ? task.id : undefined);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // Suppress click after a drag — dnd-kit fires click after drag end.
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative w-full cursor-grab overflow-hidden rounded-lg border border-border bg-card pl-4 pr-3 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
        isDragging && "cursor-grabbing",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 h-full w-[2px]",
          priorityStripClasses(task.priority),
        )}
      />
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{task.title}</span>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            priorityChipClasses(task.priority),
          )}
        >
          {task.priority}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">{initialsOf(task.assigneeName)}</AvatarFallback>
          </Avatar>
          {task.subtaskCount > 0 && (
            // Stop propagation in BOTH onPointerDown and onClick so dnd-kit
            // doesn't pick this up as a drag start, and the parent card's
            // onClick (which opens the detail dialog) stays scoped to the
            // rest of the card surface.
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Hide subtasks" : "Show subtasks"}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {task.subtaskCount} sub
            </button>
          )}
        </div>
        {due && <span className="font-mono text-xs text-muted-foreground">{due}</span>}
      </div>

      {expanded && (
        <div
          className="mt-3 border-t border-border/60 pt-2"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {subtasks.isLoading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : subtasks.data && subtasks.data.length > 0 ? (
            <ul className="space-y-1">
              {subtasks.data.map((s) => (
                <SubtaskRow
                  key={s.id}
                  subtask={s}
                  onClick={() => onSubtaskClick?.(s)}
                />
              ))}
            </ul>
          ) : (
            <div className="text-[11px] italic text-muted-foreground">
              No subtasks yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SUBTASK_STATUS_DOT: Record<TaskStatus, string> = {
  TODO: "bg-muted-foreground/60",
  IN_PROGRESS: "bg-amber-400",
  DONE: "bg-emerald-400",
};

function SubtaskRow({
  subtask,
  onClick,
}: {
  subtask: Task;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-accent/40"
      >
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            SUBTASK_STATUS_DOT[subtask.status],
          )}
        />
        <span
          className={cn(
            "flex-1 truncate",
            subtask.status === "DONE" && "text-muted-foreground line-through",
          )}
        >
          {subtask.title}
        </span>
        {subtask.assigneeName && (
          <Avatar className="h-4 w-4 shrink-0">
            <AvatarFallback className="text-[8px]">
              {initialsOf(subtask.assigneeName)}
            </AvatarFallback>
          </Avatar>
        )}
      </button>
    </li>
  );
}

interface DroppableColumnProps {
  status: TaskStatus;
  label: string;
  dot: string;
  children: React.ReactNode;
  count: number;
  onAdd?: () => void;
}

function DroppableColumn({ status, label, dot, children, count, onAdd }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-border bg-muted/20 p-3 transition-colors",
        isOver && "border-primary/60 bg-primary/5",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
          <span className="font-display text-sm font-semibold uppercase tracking-wider">
            {label}
          </span>
          <span className="rounded-full bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            {count}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Add task to ${label}`}
          >
            + New
          </button>
        )}
      </div>
      <div className="min-h-[60px] space-y-2">{children}</div>
    </div>
  );
}

interface Props {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onColumnAdd?: (status: TaskStatus) => void;
  onTaskMove?: (taskId: string, newStatus: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onCardClick, onColumnAdd, onTaskMove }: Props) {
  // Require small movement before triggering drag so plain clicks still register.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !onTaskMove) return;
    const overId = String(over.id);
    if (!overId.startsWith("col-")) return;
    const newStatus = overId.slice("col-".length) as TaskStatus;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    onTaskMove(taskId, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.id);
          return (
            <DroppableColumn
              key={col.id}
              status={col.id}
              label={col.label}
              dot={col.dot}
              count={columnTasks.length}
              onAdd={onColumnAdd ? () => onColumnAdd(col.id) : undefined}
            >
              {columnTasks.map((t) => (
                <DraggableTaskCard
                  key={t.id}
                  task={t}
                  onClick={() => onCardClick(t)}
                  onSubtaskClick={onCardClick}
                />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                  No tasks here
                </div>
              )}
            </DroppableColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
