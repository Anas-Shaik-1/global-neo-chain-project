import { useMemo, type ReactNode } from "react";
import {
  Responsive,
  WidthProvider,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout/legacy";

// react-grid-layout 2.x ships a v1-shape API on the `/legacy` subpath
// (Responsive + WidthProvider). The v2 entry point is a hook-based rewrite
// without WidthProvider; switching to /legacy keeps the diff small while
// getting us a stable, well-tested grid surface.
type Layouts = ResponsiveLayouts;

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Public widget contract. Each widget supplies its own render fn and
 * default geometry expressed in 12-column grid units. `minW`/`minH` are
 * carried through for completeness but no longer act as resize floors —
 * the grid is locked.
 */
export interface DashboardWidget {
  id: string;
  /** Human-readable label, kept for accessibility. */
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
}

const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 } as const;
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 } as const;
const ROW_HEIGHT = 56;

/**
 * Project an `lg`-breakpoint layout onto the smaller breakpoints. We
 * collapse to a single column on tiny screens (xxs/xs) and use a 2-up
 * arrangement on sm/md, keeping the source order. Far simpler than
 * letting react-grid-layout's `compactType` re-flow at runtime, which
 * tends to put cards in surprising places.
 */
function deriveBreakpointLayouts(widgets: DashboardWidget[]): Layouts {
  const lg: LayoutItem[] = widgets.map((w) => ({
    i: w.id,
    x: w.defaultLayout.x,
    y: w.defaultLayout.y,
    w: w.defaultLayout.w,
    h: w.defaultLayout.h,
    static: true,
  }));

  const md: LayoutItem[] = lg.map((it) => ({
    ...it,
    w: Math.max(2, Math.min(10, Math.round((it.w * 10) / 12))),
  }));

  const sm: LayoutItem[] = widgets.map((w, i) => ({
    i: w.id,
    x: w.defaultLayout.w >= 6 ? 0 : (i % 2) * 3,
    y: i,
    w: w.defaultLayout.w >= 6 ? 6 : 3,
    h: w.defaultLayout.h,
    static: true,
  }));

  const xs: LayoutItem[] = widgets.map((w, i) => ({
    i: w.id,
    x: 0,
    y: i,
    w: 4,
    h: w.defaultLayout.h,
    static: true,
  }));

  const xxs: LayoutItem[] = widgets.map((w, i) => ({
    i: w.id,
    x: 0,
    y: i,
    w: 2,
    h: Math.max(2, w.defaultLayout.h),
    static: true,
  }));

  return { lg, md, sm, xs, xxs };
}

/**
 * Static widget grid. Renders widgets at their default geometry per
 * breakpoint with no drag, resize, or persistence — what you see is what
 * the role gets, every load.
 */
export function WidgetGrid({ widgets }: WidgetGridProps) {
  const layouts = useMemo(() => deriveBreakpointLayouts(widgets), [widgets]);

  return (
    <ResponsiveGridLayout
      className="widget-grid"
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={false}
      isResizable={false}
      compactType="vertical"
      useCSSTransforms
      measureBeforeMount={false}
    >
      {widgets.map((w) => (
        <div
          key={w.id}
          className="widget group/widget relative overflow-hidden rounded-xl"
        >
          {/* `[&>*]:h-full [&>*]:w-full` forces the rendered widget root to
              stretch to fill the grid cell — without this, every Card /
              Metric child keeps its intrinsic content height. */}
          <div className="h-full w-full overflow-hidden [&>*]:h-full [&>*]:w-full">
            {w.render()}
          </div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}
