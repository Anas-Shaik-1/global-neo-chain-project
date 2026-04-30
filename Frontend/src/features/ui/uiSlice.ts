import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Theme = "dark" | "light";

export interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  /**
   * Desktop-only icon-only mode. Distinct from {@link sidebarOpen}, which is
   * the mobile drawer's open/closed state.
   */
  sidebarCollapsed: boolean;
}

function readPersistedTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const v = localStorage.getItem("ems.theme");
  return v === "light" ? "light" : "dark";
}

function readPersistedCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem("ems.sidebar.collapsed") === "1";
}

function persistCollapsed(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("ems.sidebar.collapsed", value ? "1" : "0");
}

const initialState: UiState = {
  theme: readPersistedTheme(),
  sidebarOpen: true,
  sidebarCollapsed: readPersistedCollapsed(),
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    themeChanged(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    sidebarToggled(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    sidebarCollapseToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      persistCollapsed(state.sidebarCollapsed);
    },
    sidebarCollapseSet(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
      persistCollapsed(state.sidebarCollapsed);
    },
  },
});

export const {
  themeChanged,
  sidebarToggled,
  sidebarCollapseToggled,
  sidebarCollapseSet,
} = uiSlice.actions;
