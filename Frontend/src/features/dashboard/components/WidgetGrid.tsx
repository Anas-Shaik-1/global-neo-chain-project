import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import {
  Responsive,
  WidthProvider,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout/legacy";
import { cn } from "@/lib/utils";

// react-grid-layout 2.x ships a v1-shape API on the `/legacy` subpath
// (Responsive + WidthProvider). The v2 entry point is a hook-based rewrite
// without WidthProvider; switching to /legacy keeps the diff small while
// getting us a stable, well-tested grid surface.
type Layouts = ResponsiveLayouts;

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Public widget contract. Each widget supplies its own render fn and
 * default geometry expressed in 12-column grid units. `minW`/`minH` are
 * the floor the user can resize to — they prevent a content card from
 * being shrunk below readability.
 */
export interface DashboardWidget {
  id: string;
  /** Human-readable label shown in edit mode and used for the drag aria-label. */
  label: string;
  /** Default geometry on the `lg` breakpoint (12 cols). Other breakpoints
   *  derive from this — see `deriveBreakpointLayouts`. */
  defaultLayout: {
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
  };
  render: () => ReactNode;
}

interface WidgetGridProps {
  widgets: DashboardWidget[];
  /** localStorage key. Per-role so an admin's layout doesn't bleed into HR's. */
  storageKey: string;
  /** When true, drag/resize handles are revealed and the grid becomes editable. */
  editing: boolean;
}

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;
const ROW_HEIGHT = 56;

/**
 * Project an `lg`-breakpoint layout onto the smaller breakpoints. We
 * collapse to a single column on tiny screens (xxs/xs) and use a 2-up
 * arrangement on sm/md, keeping the source order. Far simpler than
 * letting react-grid-layout's `compactType` re-flow at runtime, which
 * tends to put resizable cards in surprising places.
 */
function deriveBreakpointLayouts(widgets: DashboardWidget[]): Layouts {
  const lg: LayoutItem[] = widgets.map((w) => ({
    i: w.id,
    x: w.defaultLayout.x,
    y: w.defaultLayout.y,
    w: w.defaultLayout.w,
    h: w.defaultLayout.h,
    minW: w.defaultLayout.minW,
    minH: w.defaultLayout.minH,
  }));

  // md (10 cols): scale lg widths by ~5/6 with a min of the widget's minW.
  const md: LayoutItem[] = lg.map((it) => ({
    ...it,
    w: Math.max(it.minW ?? 2, Math.min(10, Math.round((it.w * 10) / 12))),
  }));

  // sm (6 cols): half-width or full-width tiers — anything ≥ half-width
  // becomes full width on sm.
  const sm: LayoutItem[] = widgets.map((w, i) => ({
    i: w.id,
    x: w.defaultLayout.w >= 6 ? 0 : (i % 2) * 3,
    y: i,
    w: w.defaultLayout.w >= 6 ? 6 : 3,
    h: w.defaultLayout.h,
    minW: w.defaultLayout.minW,
    minH: w.defaultLayout.minH,
  }));

  // xs (4 cols): single column stack.
  const xs: LayoutItem[] = widgets.map((w, i) => ({
    i: w.id,
    x: 0,
    y: i,
    w: 4,
    h: w.defaultLayout.h,
    minW: w.defaultLayout.minW,
    minH: w.defaultLayout.minH,
  }));

  // xxs (2 cols): single column, slightly taller for tap targets.
  const xxs: LayoutItem[] = widgets.map((w, i) => ({
    i: w.id,
    x: 0,
    y: i,
    w: 2,
    h: Math.max(2, w.defaultLayout.h),
    minW: w.defaultLayout.minW,
    minH: w.defaultLayout.minH,
  }));

  return { lg, md, sm, xs, xxs };
}

function loadLayouts(key: string): Layouts | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Layouts;
  } catch {
    return null;
  }
}

function saveLayouts(key: string, layouts: Layouts): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(layouts));
  } catch {
    // Storage may be disabled — silently no-op.
  }
}

/**
 * Reconcile a persisted layout against the live widget set.
 *
 * The persisted `Layouts` may be missing widgets that were added in a
 * later release (e.g. the calendar trend card we just shipped) and may
 * carry stale ids for widgets that were removed. We:
 *   - drop entries whose `i` no longer exists in `widgets`
 *   - append entries for new widgets at the bottom of each breakpoint
 *   - preserve user-edited geometry (x/y/w/h) for everything in between
 */
function mergeLayouts(persisted: Layouts | null, widgets: DashboardWidget[]): Layouts {
  const defaults = deriveBreakpointLayouts(widgets);
  if (!persisted) return defaults;

  const merged: Layouts = {};
  const knownIds = new Set(widgets.map((w) => w.id));

  for (const bp of Object.keys(defaults)) {
    const def = (defaults[bp] ?? []) as LayoutItem[];
    const saved = ((persisted[bp] ?? []) as LayoutItem[]).filter(
      (it: LayoutItem) => knownIds.has(it.i),
    );
    const savedIds = new Set(saved.map((it: LayoutItem) => it.i));
    const missing = def.filter((it: LayoutItem) => !savedIds.has(it.i));
    // Place new (missing) widgets at the bottom by giving them y = max+1
    const maxY = saved.reduce(
      (m: number, it: LayoutItem) => Math.max(m, it.y + it.h),
      0,
    );
    const placed = missing.map((it: LayoutItem, i: number) => ({
      ...it,
      y: maxY + i,
    }));
    merged[bp] = [...saved, ...placed];
  }
  return merged;
}

/**
 * Drag-and-resize widget grid. Visual conventions:
 *   - Edit mode shows a faint dashed frame on each tile + a grip handle
 *     at the top-left and a corner resize handle at the bottom-right.
 *   - Outside edit mode the grid is fully locked; clicks behave normally
 *     so the cards' inner Links/Buttons stay clickable.
 *   - The `.widget-drag-handle` class scopes the drag area so users can
 *     still interact with content even while editing — only the handle
 *     initiates a drag.
 */
export function WidgetGrid({ widgets, storageKey, editing }: WidgetGridProps) {
  const [layouts, setLayouts] = useState<Layouts>(() =>
    mergeLayouts(loadLayouts(storageKey), widgets),
  );

  // Track whether the layouts state should be re-merged when the widget set
  // changes mid-session (e.g. a role gate flip adds a payroll trend card).
  const widgetIdsKey = useMemo(
    () => widgets.map((w) => w.id).join("|"),
    [widgets],
  );
  // Skip the first effect run — initial state is already merged.
  const initial = useRef(true);
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    setLayouts((prev) => mergeLayouts(prev, widgets));
    // widgetIdsKey is the stable signal; widgets reference is excluded
    // intentionally to avoid resetting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetIdsKey]);

  const onLayoutChange = useCallback(
    (_current: Layout, all: Layouts) => {
      setLayouts(all);
      saveLayouts(storageKey, all);
    },
    [storageKey],
  );

  return (
    <ResponsiveGridLayout
      className={cn("widget-grid", editing && "widget-grid--editing")}
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle=".widget-drag-handle"
      compactType="vertical"
      onLayoutChange={onLayoutChange}
      // Animations on layout changes feel laggy with heavy chart children;
      // disable per the library's own perf note.
      useCSSTransforms
      measureBeforeMount={false}
    >
      {widgets.map((w) => (
        <div
          key={w.id}
          className={cn(
            "widget group/widget relative overflow-hidden rounded-xl",
            editing &&
              "outline-dashed outline-1 outline-offset-2 outline-primary/40",
          )}
        >
          {editing && (
            <div className="widget-drag-handle pointer-events-auto absolute left-2 top-2 z-20 inline-flex cursor-grab items-center gap-1.5 rounded-md border border-border/60 bg-card/90 px-1.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur-sm hover:text-foreground active:cursor-grabbing">
              <GripVertical className="h-3 w-3" />
              <span className="hidden sm:inline">{w.label}</span>
            </div>
          )}
          {/* `[&>*]:h-full [&>*]:w-full` forces the rendered widget root to
              stretch to fill the grid cell. Without this, every Card / Metric
              child kept its intrinsic content height even when the user
              resized the cell to be much taller. */}
          <div className="h-full w-full overflow-hidden [&>*]:h-full [&>*]:w-full">
            {w.render()}
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
