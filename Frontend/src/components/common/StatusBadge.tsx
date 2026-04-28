import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warn" | "danger" | "info";

const TONES: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warn:    "bg-amber-500/10 text-amber-400 border-amber-500/30",
  danger:  "bg-red-500/10 text-red-400 border-red-500/30",
  info:    "bg-primary/10 text-primary border-primary/30",
};

export function StatusBadge({ children, tone = "default", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider",
      TONES[tone],
      className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
