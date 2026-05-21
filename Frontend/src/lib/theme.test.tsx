import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "./theme";

beforeEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("ThemeProvider", () => {
  it("always applies the 'dark' class — light theme has been removed", () => {
    render(<ThemeProvider>kid</ThemeProvider>);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
