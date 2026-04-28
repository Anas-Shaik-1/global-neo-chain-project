import { cn } from "@/lib/utils";

interface Props {
  showTagline?: boolean;
  className?: string;
}

export function BrandText({ showTagline = true, className }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="bg-gradient-to-r from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)] bg-clip-text text-base font-black tracking-wide text-transparent sm:text-2xl">
        Global <span className="text-foreground">NeoChain</span>
      </span>
      {showTagline && (
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground sm:text-xs">
          Enterprise edition
        </span>
      )}
    </div>
  );
}
