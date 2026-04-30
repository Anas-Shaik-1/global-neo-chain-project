import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { uiSlice } from "@/features/ui/uiSlice";
import { authSlice } from "@/features/auth/authSlice";
import { ThemeProvider } from "./theme";

function buildStore(theme: "dark" | "light") {
  return configureStore({
    reducer: { ui: uiSlice.reducer, auth: authSlice.reducer },
    preloadedState: {
      ui: { theme, sidebarOpen: true, sidebarCollapsed: false },
      auth: { accessToken: null, user: null },
    },
  });
}

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

describe("ThemeProvider", () => {
  it("adds 'dark' class for dark theme", () => {
    render(
      <Provider store={buildStore("dark")}>
        <ThemeProvider>kid</ThemeProvider>
      </Provider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes 'dark' class for light theme", () => {
    render(
      <Provider store={buildStore("light")}>
        <ThemeProvider>kid</ThemeProvider>
      </Provider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists theme to localStorage", () => {
    render(
      <Provider store={buildStore("light")}>
        <ThemeProvider>kid</ThemeProvider>
      </Provider>,
    );
    expect(localStorage.getItem("ems.theme")).toBe("light");
  });
});
