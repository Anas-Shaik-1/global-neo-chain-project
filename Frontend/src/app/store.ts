import { configureStore } from "@reduxjs/toolkit";
import { authSlice } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
