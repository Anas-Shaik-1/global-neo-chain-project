import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  /** Highlight this card as the headline metric on its row. */
  accent?: boolean;
  /**
   * Optional tone for hint text — surfaces a +/- delta in colour. Falls back
   * to muted-foreground when not provided.
   */
  hintTone?: "default" | "success" | "danger" | "info";
  className?: string;
}

const HINT_TONES: Record<NonNullable<Props["hintTone"]>, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-400",
  danger: "text-red-400",
  info: "text-primary",
};

/**
 * Standard KPI tile. Consistent typography rhythm across every dashboard
 * row — eyebrow label, large display numeral, optional hint.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  accent,
  hintTone = "default",
  className,
}: Props) {
  return (
    <div
      className={cn(
        // `h-full w-full` lets the card fill any container that gives it
        // explicit dimensions (e.g. the resizable dashboard widget cell).
        // Inside a normal flex/grid the height collapses to content as
        // before, so this is purely additive.
        "group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card p-5 transition-all duration-200",
        accent
          ? "border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]"
          : "border-border/60 hover:border-border",
        className,
      )}
    >
      {accent && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
        />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </div>
          <div className="font-display text-[28px] font-semibold leading-none tracking-tight text-foreground">
            {value}
          </div>
          {hint && (
            <div className={cn("text-xs", HINT_TONES[hintTone])}>{hint}</div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/40 transition-colors",
              accent ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
