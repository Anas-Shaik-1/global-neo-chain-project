import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getApi } from "@/api/axios";
import { queryClient } from "@/lib/queryClient";
import { disconnectChatSocket } from "@/features/chat/socket";
import { disconnectCallsSocket } from "@/features/calls/socket";
import { presenceCleared } from "@/features/chat/presenceSlice";
import { sessionEstablished, sessionCleared, accessTokenRefreshed, type AuthUser } from "./authSlice";

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// /auth/login may return either { accessToken, user } OR { requires2FA: true }
// when the user has TOTP enabled. The thunk discriminates and returns a tagged union.
type LoginResult =
  | { kind: "ok"; accessToken: string; user: AuthUser }
  | { kind: "2fa-required" };

interface Login2FAInput extends LoginInput {
  token: string;
}

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}

export const loginThunk = createAsyncThunk<
  LoginResult,
  LoginInput,
  { rejectValue: string }
>("auth/login", async (input, { dispatch, rejectWithValue }) => {
  try {
    const res = await getApi().post<LoginResponse | { requires2FA: true }>("/auth/login", input);
    if ("requires2FA" in res.data && res.data.requires2FA) {
      return { kind: "2fa-required" } as const;
    }
    const data = res.data as LoginResponse;
    dispatch(sessionEstablished({ accessToken: data.accessToken, user: data.user }));
    return { kind: "ok", accessToken: data.accessToken, user: data.user } as const;
  } catch (err) {
    return rejectWithValue(extractMessage(err, "Login failed"));
  }
});

export const login2FAThunk = createAsyncThunk<
  LoginResponse,
  Login2FAInput,
  { rejectValue: string }
>("auth/login2fa", async (input, { dispatch, rejectWithValue }) => {
  try {
    const res = await getApi().post<LoginResponse>("/auth/login-2fa", input);
    dispatch(sessionEstablished({ accessToken: res.data.accessToken, user: res.data.user }));
    return res.data;
  } catch (err) {
    return rejectWithValue(extractMessage(err, "Login failed"));
  }
});

export const logoutThunk = createAsyncThunk("auth/logout", async (_arg, { dispatch }) => {
  try {
    await getApi().post("/auth/logout");
  } catch {
    // ignore — logout is best-effort
  } finally {
    dispatch(sessionCleared());
    dispatch(presenceCleared());
    // Tear down realtime sockets so the next login establishes fresh
    // connections with the new auth context.
    try {
      disconnectChatSocket();
    } catch {
      // ignore
    }
    try {
      disconnectCallsSocket();
    } catch {
      // ignore
    }
    // Drop all cached server state so a subsequent login doesn't briefly
    // render the previous user's data.
    queryClient.clear();
  }
});

export const bootstrapSessionThunk = createAsyncThunk<
  { user: AuthUser },
  void,
  { rejectValue: string }
>("auth/bootstrap", async (_arg, { dispatch, rejectWithValue }) => {
  try {
    const refresh = await getApi().post<{ accessToken: string }>("/auth/refresh");
    dispatch(accessTokenRefreshed(refresh.data.accessToken));
    const me = await getApi().get<{ user: AuthUser }>("/auth/me");
    dispatch(sessionEstablished({ accessToken: refresh.data.accessToken, user: me.data.user }));
    return me.data;
  } catch (err) {
    dispatch(sessionCleared());
    return rejectWithValue(extractMessage(err, "Session expired"));
  }
});
