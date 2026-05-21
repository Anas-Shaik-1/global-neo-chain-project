import { useEffect, type ReactNode } from "react";

/**
 * Always-dark theme. The light theme has been removed; this provider
 * exists only to ensure `<html>` always carries the `dark` class so any
 * tooling that keys off it keeps working. Toggle UI was removed from
 * the topbar.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <>{children}</>;
}
