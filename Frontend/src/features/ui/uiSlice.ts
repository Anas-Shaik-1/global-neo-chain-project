import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Theme = "dark" | "light";

export interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
}

function readPersistedTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const v = localStorage.getItem("ems.theme");
  return v === "light" ? "light" : "dark";
}

const initialState: UiState = {
  theme: readPersistedTheme(),
  sidebarOpen: true,
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
  },
});

export const { themeChanged, sidebarToggled } = uiSlice.actions;
