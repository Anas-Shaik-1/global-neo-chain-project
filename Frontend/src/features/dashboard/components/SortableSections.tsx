import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

export interface DashboardSectionDef {
  id: string;
  label: string;
  render: () => ReactNode;
}

interface Props {
  /**
   * The full set of sections available on this dashboard variant. Order
   * here is the *default* — `storageKey`'s persisted value overrides it.
   */
  sections: DashboardSectionDef[];
  /** localStorage key used to persist the per-user order. */
  storageKey: string;
  /** When true, drag handles are visible and rows become reorderable. */
  editing: boolean;
}

function loadOrder(key: string): string[] | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

function saveOrder(key: string, ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // localStorage may be disabled (private browsing) — silently no-op.
  }
}

/**
 * Reorder a dashboard's stack of sections, persisting the user's preferred
 * order per-role in localStorage. The `editing` flag flips drag handles on
 * and gives the rows a faint visual frame so it's clear they're movable.
 *
 * Sections are merged with the persisted order on every render so newly
 * added sections (e.g. when a future release introduces a "Birthdays"
 * widget) automatically appear at the bottom of the existing order rather
 * than disappearing because they aren't in the saved list.
 */
export function SortableSections({ sections, storageKey, editing }: Props) {
  const defaultOrder = useMemo(() => sections.map((s) => s.id), [sections]);
  const [order, setOrder] = useState<string[]>(() => {
    const persisted = loadOrder(storageKey);
    if (!persisted) return defaultOrder;
    // Merge: keep persisted order for known ids, append any new ids at end.
    const known = new Set(defaultOrder);
    const merged = persisted.filter((id) => known.has(id));
    for (const id of defaultOrder) if (!merged.includes(id)) merged.push(id);
    return merged;
  });

  // Keep the persisted order on every change.
  useEffect(() => {
    saveOrder(storageKey, order);
  }, [storageKey, order]);

  // Defaults can drift mid-session if the underlying section list changes
  // (e.g. a role gate flips). Reconcile against new defaults so we don't
  // render stale ids.
  useEffect(() => {
    setOrder((prev) => {
      const known = new Set(defaultOrder);
      const merged = prev.filter((id) => known.has(id));
      for (const id of defaultOrder) if (!merged.includes(id)) merged.push(id);
      return merged.length === prev.length &&
        merged.every((id, i) => id === prev[i])
        ? prev
        : merged;
    });
  }, [defaultOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 6px tolerance avoids click-vs-drag confusion on links inside cards.
      activationConstraint: { distance: 6 },
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  const byId = new Map(sections.map((s) => [s.id, s]));
  const stack = order.map((id) => byId.get(id)).filter(Boolean) as DashboardSectionDef[];

  return (
    <div className="space-y-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {stack.map((s) => (
            <SortableRow key={s.id} id={s.id} label={s.label} editing={editing}>
              {s.render()}
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface RowProps {
  id: string;
  label: string;
  editing: boolean;
  children: ReactNode;
}

function SortableRow({ id, label, editing, children }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        editing && "rounded-xl border border-dashed border-primary/40 bg-primary/[0.02] p-3",
        isDragging && "z-10 shadow-2xl",
      )}
    >
      {editing && (
        <button
          type="button"
          aria-label={`Drag ${label}`}
          {...attributes}
          {...listeners}
          className="absolute -left-3 top-3 z-10 inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground shadow-sm hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {editing && (
        <div className="mb-2 ml-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
      )}
      {children}
    </section>
  );
}
