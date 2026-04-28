import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Role = "ADMIN" | "HR" | "EMPLOYEE" | "PM";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
  // Auth-extensions: present on responses from a current backend; older payloads
  // (and existing tests) may omit these fields, so they're optional.
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionEstablished(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    },
    accessTokenRefreshed(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    sessionCleared() {
      return initialState;
    },
  },
});

export const { sessionEstablished, accessTokenRefreshed, sessionCleared } = authSlice.actions;
