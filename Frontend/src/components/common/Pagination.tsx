import { useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  pageSizeOptions?: number[];
  /** Optional copy override — defaults to "items". Used in the summary line. */
  noun?: string;
  className?: string;
  /** Hold-shift+arrow steps a page; arrow alone is a no-op. Off by default
   *  to avoid hijacking arrow keys inside scroll containers. */
  enableKeyboardShortcuts?: boolean;
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

/**
 * Build the page-button list with ellipses around long gaps. Linear /
 * Stripe-style window logic:
 *   • ≤ 7 pages → show all
 *   • near start → 1 2 3 4 5 … last
 *   • near end → 1 … last-4..last
 *   • middle → 1 … current-1 current current+1 … last
 */
function buildPageRange(
  current: number,
  total: number,
): (number | "ellipsis-l" | "ellipsis-r")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-r", total];
  }
  if (current >= total - 3) {
    return [1, "ellipsis-l", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "ellipsis-l", current - 1, current, current + 1, "ellipsis-r", total];
}

/**
 * Refined pagination — surface-aware. Sits below the table and reads as a
 * single composed bar rather than a row of orphaned widgets:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Showing 1–10 of 142 employees      Rows: [25 ▾]   « ‹ 1 2 3 … 9 › » │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Compared to v1: explicit "Showing X–Y of Z" copy (no terse "1–10 / 142"),
 * dedicated first/last jumpers, all controls live in a soft card so the
 * pagination feels like a single object, and Shift+← / Shift+→ step pages
 * when `enableKeyboardShortcuts` is set.
 */
export function Pagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  noun = "items",
  enableKeyboardShortcuts = false,
  className,
}: Props) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const atFirst = page <= 1;
  const atLast = page >= totalPages || totalPages === 0;

  // Keyboard nav — Shift + arrow because plain arrows would hijack scroll
  // containers and dialogs. Only active while the component is mounted.
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey) return;
      if (e.key === "ArrowLeft" && !atFirst) {
        e.preventDefault();
        onPageChange(page - 1);
      } else if (e.key === "ArrowRight" && !atLast) {
        e.preventDefault();
        onPageChange(page + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableKeyboardShortcuts, atFirst, atLast, page, onPageChange]);

  if (totalItems === 0) return null;
  const range = buildPageRange(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border/50 bg-card/30 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
        className,
      )}
    >
      {/* Left: explicit summary + rows-per-page selector */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          Showing{" "}
          <span className="font-semibold text-foreground">{start}</span>
          <span className="mx-1 text-muted-foreground/60">–</span>
          <span className="font-semibold text-foreground">{end}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems}</span>{" "}
          {noun}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="hidden text-muted-foreground/70 sm:inline">·</span>
            <span className="text-muted-foreground/80">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger
                className="h-7 w-[68px] border-border/60 bg-background/50 px-2 text-xs"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right: nav cluster — first / prev / pages / next / last */}
      <div className="flex items-center gap-0.5">
        <NavArrow
          dir="first"
          onClick={() => onPageChange(1)}
          disabled={atFirst}
        />
        <NavArrow
          dir="prev"
          onClick={() => onPageChange(page - 1)}
          disabled={atFirst}
        />

        {/* Numbered buttons — desktop */}
        <div className="hidden items-center px-1 sm:flex">
          {range.map((item, idx) => {
            if (item === "ellipsis-l" || item === "ellipsis-r") {
              return (
                <span
                  key={`${item}-${idx}`}
                  aria-hidden
                  className="flex h-8 w-7 items-center justify-center text-xs text-muted-foreground/50"
                >
                  …
                </span>
              );
            }
            const isActive = item === page;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "mx-0.5 flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums outline-none transition-all",
                  "focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Mobile compact indicator — page X / Y */}
        <span className="px-2 text-xs tabular-nums text-muted-foreground sm:hidden">
          Page <span className="font-semibold text-foreground">{page}</span>{" "}
          <span className="text-muted-foreground/60">/</span> {totalPages}
        </span>

        <NavArrow
          dir="next"
          onClick={() => onPageChange(page + 1)}
          disabled={atLast}
        />
        <NavArrow
          dir="last"
          onClick={() => onPageChange(totalPages)}
          disabled={atLast}
        />
      </div>
    </div>
  );
}

function NavArrow({
  dir,
  onClick,
  disabled,
}: {
  dir: "first" | "prev" | "next" | "last";
  onClick: () => void;
  disabled: boolean;
}) {
  const Icon =
    dir === "first"
      ? ChevronsLeft
      : dir === "prev"
        ? ChevronLeft
        : dir === "next"
          ? ChevronRight
          : ChevronsRight;
  const label =
    dir === "first"
      ? "First page"
      : dir === "prev"
        ? "Previous page"
        : dir === "next"
          ? "Next page"
          : "Last page";
  // First/last hidden on the smallest screens to keep the bar tight; on
  // mobile users tap their way page by page anyway.
  const isJumper = dir === "first" || dir === "last";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground outline-none transition-colors",
        "hover:border-border/60 hover:bg-accent/60 hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-primary",
        disabled && "pointer-events-none opacity-30",
        isJumper && "hidden sm:flex",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
