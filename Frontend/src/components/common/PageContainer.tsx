import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Width tokens for top-level page content. Picking a single shared set of
 * widths keeps every screen visually aligned — no more drift between
 * `max-w-2xl` here, `max-w-3xl` there, and an unbounded width somewhere else.
 *
 * - `narrow`  — single-record / form-centric pages (Profile, ChangePassword)
 * - `default` — standard data screens (Departments, Calls, Attendance)
 * - `wide`    — dashboards, kanbans, list grids that benefit from breathing room
 * - `full`    — opt-out for screens that own their own width (Messages chat)
 */
export type PageContainerWidth = "narrow" | "default" | "wide" | "full";

const WIDTHS: Record<PageContainerWidth, string> = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-none",
};

interface Props {
  children: ReactNode;
  width?: PageContainerWidth;
  className?: string;
}

export function PageContainer({ children, width = "default", className }: Props) {
  return (
    <div className={cn("mx-auto w-full", WIDTHS[width], className)}>
      {children}
    </div>
  );
}
