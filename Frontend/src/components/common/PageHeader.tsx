import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * Small uppercase mono label rendered above the title — useful as a
   * section/category indicator (e.g. "Finance · Expenses"). Optional;
   * existing pages keep working without it.
   */
  eyebrow?: string;
  className?: string;
}

/**
 * Standard page-level header. Consistent across every screen so users
 * recognise the visual rhythm: eyebrow → title → description → actions.
 * On mobile the actions reflow below the title block; on `sm+` they
 * align to the bottom of the title row for a clean baseline.
 */
export function PageHeader({ title, description, actions, eyebrow, className }: Props) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
