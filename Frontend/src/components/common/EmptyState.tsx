import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ label, hint = "Nothing here yet.", icon, action, className }: Props) {
  return (
    <div className={cn("flex h-full min-h-[40vh] flex-col items-center justify-center text-center", className)}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-muted-foreground">
        {icon ?? <span className="font-display text-2xl">∅</span>}
      </div>
      <div className="font-display text-2xl font-semibold tracking-tight">{label}</div>
      <div className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
