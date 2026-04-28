import { describe, it, expect } from "vitest";
import { uiSlice, themeChanged, sidebarToggled, type UiState } from "./uiSlice";

describe("uiSlice", () => {
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
});
