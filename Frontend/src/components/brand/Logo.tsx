import { Link } from "react-router-dom";
import { BrandText } from "./BrandText";
import { cn } from "@/lib/utils";

interface Props {
  isClickable?: boolean;
  showTagline?: boolean;
  className?: string;
}

function LogoMark({ showTagline, className }: Pick<Props, "showTagline" | "className">) {
  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-3", className)}>
      <div className="relative h-9 w-9 shrink-0 sm:h-10 sm:w-10">
        <img src="/logo.png" alt="Global NeoChain" className="h-full w-full object-contain" />
      </div>
      <BrandText showTagline={showTagline} />
    </div>
  );
}

export function Logo({ isClickable = false, showTagline = true, className }: Props) {
  if (isClickable) {
    return (
      <Link to="/" className="group flex min-w-0 shrink-0 items-center">
        <LogoMark showTagline={showTagline} className={className} />
      </Link>
    );
  }
  return <LogoMark showTagline={showTagline} className={className} />;
}
