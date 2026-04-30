import { describe, it, expect, beforeEach } from "vitest";
import {
  uiSlice,
  themeChanged,
  sidebarToggled,
  sidebarCollapseToggled,
  type UiState,
} from "./uiSlice";

describe("uiSlice", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const init = (): UiState => uiSlice.getInitialState();

  it("defaults to dark theme + sidebar open", () => {
    const s = init();
    expect(s.theme).toBe("dark");
    expect(s.sidebarOpen).toBe(true);
  });

  it("themeChanged updates theme", () => {
    const next = uiSlice.reducer(init(), themeChanged("light"));
    expect(next.theme).toBe("light");
  });

  it("sidebarToggled flips sidebarOpen", () => {
    const a = uiSlice.reducer(init(), sidebarToggled());
    expect(a.sidebarOpen).toBe(false);
    const b = uiSlice.reducer(a, sidebarToggled());
    expect(b.sidebarOpen).toBe(true);
  });

  it("sidebarCollapseToggled flips sidebarCollapsed and persists to localStorage", () => {
    const a = uiSlice.reducer(init(), sidebarCollapseToggled());
    expect(a.sidebarCollapsed).toBe(true);
    expect(localStorage.getItem("ems.sidebar.collapsed")).toBe("1");
    const b = uiSlice.reducer(a, sidebarCollapseToggled());
    expect(b.sidebarCollapsed).toBe(false);
    expect(localStorage.getItem("ems.sidebar.collapsed")).toBe("0");
  });
});
