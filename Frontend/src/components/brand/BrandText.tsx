import { cn } from "@/lib/utils";

interface Props {
  showTagline?: boolean;
  className?: string;
}

export function BrandText({ showTagline = true, className }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="bg-gradient-to-r from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)] bg-clip-text text-base font-black tracking-wide text-transparent sm:text-2xl">
        SMS-IP
      </span>
      {showTagline && (
        <>
          <span className="hidden whitespace-nowrap text-[8px] font-semibold tracking-wider text-[hsl(190,70%,50%)] sm:block sm:text-[9px] md:text-[11px]">
            Sehat - Meyer - Sejahtera
          </span>
          <span className="hidden whitespace-nowrap text-[7px] font-medium tracking-wide text-[hsl(190,60%,45%)]/70 sm:block sm:text-[8px] md:text-[10px]">
            Indonesian professionals
          </span>
        </>
      )}
    </div>
  );
}
