import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page-level wrapper. Per app-wide design decision, screens and sections use
 * the *full* available width — no max-width clamps. The horizontal gutters
 * live on the AppLayout `<main>` so every page inherits matching rhythm.
 *
 * The `width` prop is preserved as a no-op for backwards compatibility with
 * existing callers (`width="wide"`, `width="default"`, etc.) that pre-date
 * this change. New code should omit it.
 */
export type PageContainerWidth = "narrow" | "default" | "wide" | "full";

interface Props {
  children: ReactNode;
  /** @deprecated Kept for back-compat; all variants render full width now. */
  width?: PageContainerWidth;
  className?: string;
}

export function PageContainer({ children, className }: Props) {
  return <div className={cn("w-full", className)}>{children}</div>;
}
