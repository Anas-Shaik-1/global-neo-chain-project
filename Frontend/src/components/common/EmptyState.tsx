import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint?: string;
  className?: string;
}

export function EmptyState({ label, hint = "Coming soon.", className }: Props) {
  return (
    <div className={cn("flex h-full min-h-[40vh] flex-col items-center justify-center text-center", className)}>
      <div className="mb-2 text-2xl font-semibold tracking-tight">{label}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}
