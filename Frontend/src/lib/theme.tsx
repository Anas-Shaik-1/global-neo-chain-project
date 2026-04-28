import { useEffect, type ReactNode } from "react";
import { useAppSelector } from "@/app/hooks";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("ems.theme", theme);
  }, [theme]);

  return <>{children}</>;
}
