import { describe, it, expect, beforeEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { loginThunk, logoutThunk, bootstrapSessionThunk } from "./authThunks";

function buildStore() {
  const store = configureStore({
    reducer: { auth: authSlice.reducer, ui: uiSlice.reducer },
  });
  setupApiClient(store, "http://api");
  return store;
}

const sampleUser = {
  id: "u1",
  email: "a@b.com",
  name: "A",
  role: "ADMIN" as const,
  isProjectManager: false,
  isVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let mock: MockAdapter;
let store: ReturnType<typeof buildStore>;

beforeEach(() => {
  store = buildStore();
  mock = new MockAdapter(getApi());
});

describe("authThunks", () => {
  it("loginThunk dispatches sessionEstablished on success", async () => {
    mock.onPost("/auth/login").reply(200, { accessToken: "tk", user: sampleUser });
    await store.dispatch(loginThunk({ email: "a@b.com", password: "pw" }));
    expect(store.getState().auth.accessToken).toBe("tk");
    expect(store.getState().auth.user?.email).toBe("a@b.com");
  });

  it("loginThunk rejects with friendly message on 401", async () => {
    mock.onPost("/auth/login").reply(401, { code: "UNAUTHORIZED", message: "Invalid credentials" });
    const action = await store.dispatch(loginThunk({ email: "a@b.com", password: "wrong" }));
    expect(action.type).toBe("auth/login/rejected");
    expect((action as { payload: string }).payload).toBe("Invalid credentials");
  });

  it("logoutThunk clears the session", async () => {
    mock.onPost("/auth/logout").reply(204);
    store.dispatch(authSlice.actions.sessionEstablished({ accessToken: "tk", user: sampleUser }));
    await store.dispatch(logoutThunk());
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user).toBeNull();
  });

  it("bootstrapSessionThunk hydrates session via /auth/refresh + /auth/me", async () => {
    mock.onPost("/auth/refresh").reply(200, { accessToken: "tk" });
    mock.onGet("/auth/me").reply(200, { user: sampleUser });
    const action = await store.dispatch(bootstrapSessionThunk());
    expect(action.type).toBe("auth/bootstrap/fulfilled");
    expect(store.getState().auth.accessToken).toBe("tk");
    expect(store.getState().auth.user?.email).toBe("a@b.com");
  });

  it("bootstrapSessionThunk rejects when refresh fails", async () => {
    mock.onPost("/auth/refresh").reply(401);
    const action = await store.dispatch(bootstrapSessionThunk());
    expect(action.type).toBe("auth/bootstrap/rejected");
    expect(store.getState().auth.user).toBeNull();
  });
});
