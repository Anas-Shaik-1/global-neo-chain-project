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
        "flex flex-col gap-4 border-b border-border/40 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-7",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <div className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/85">
            <span aria-hidden className="h-px w-5 bg-primary/60" />
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[26px] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[32px]">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
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
