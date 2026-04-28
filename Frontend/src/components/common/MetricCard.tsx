import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetricCard({ label, value, hint, icon, accent, className }: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-border",
      accent && "border-primary/40",
      className,
    )}>
      {accent && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && <div className="text-primary/70">{icon}</div>}
      </div>
    </div>
  );
}
