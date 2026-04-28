import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getApi } from "@/api/axios";
import { sessionEstablished, sessionCleared, accessTokenRefreshed, type AuthUser } from "./authSlice";

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}

export const loginThunk = createAsyncThunk<
  LoginResponse,
  LoginInput,
  { rejectValue: string }
>("auth/login", async (input, { dispatch, rejectWithValue }) => {
  try {
    const res = await getApi().post<LoginResponse>("/auth/login", input);
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
  }
  dispatch(sessionCleared());
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
