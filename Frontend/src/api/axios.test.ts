import { describe, it, expect, beforeEach, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice, sessionEstablished, sessionCleared } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { createApiClient } from "./axios";

function buildStore() {
  return configureStore({
    reducer: { auth: authSlice.reducer, ui: uiSlice.reducer },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("axios client", () => {
  it("attaches Authorization header from store", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "tk-1",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isProjectManager: false, isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);
    mock.onGet("/x").reply((conf) => {
      expect(conf.headers?.Authorization).toBe("Bearer tk-1");
      return [200, { ok: true }];
    });
    const res = await api.get("/x");
    expect(res.status).toBe(200);
  });

  it("on 401, calls /auth/refresh once and retries the original request", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "old",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isProjectManager: false, isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);

    let calls = 0;
    mock.onGet("/x").reply(() => {
      calls += 1;
      const tok = store.getState().auth.accessToken;
      return tok === "new" ? [200, { ok: true }] : [401, { code: "UNAUTHORIZED" }];
    });
    mock.onPost("/auth/refresh").reply(200, { accessToken: "new" });

    const res = await api.get("/x");
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(store.getState().auth.accessToken).toBe("new");
  });

  it("on refresh failure, clears session and rejects", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "old",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isProjectManager: false, isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);
    mock.onGet("/x").reply(401, { code: "UNAUTHORIZED" });
    mock.onPost("/auth/refresh").reply(401, { code: "UNAUTHORIZED" });

    await expect(api.get("/x")).rejects.toThrow();
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user).toBeNull();
  });

  it("dedupes concurrent refreshes: a burst of 401s only triggers one /auth/refresh", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "old",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isProjectManager: false, isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);

    mock.onGet("/x").reply(() => {
      const tok = store.getState().auth.accessToken;
      return tok === "new" ? [200, { ok: true }] : [401, {}];
    });
    mock.onGet("/y").reply(() => {
      const tok = store.getState().auth.accessToken;
      return tok === "new" ? [200, { ok: true }] : [401, {}];
    });

    let refreshCount = 0;
    mock.onPost("/auth/refresh").reply(async () => {
      refreshCount += 1;
      await new Promise((r) => setTimeout(r, 10));
      return [200, { accessToken: "new" }];
    });

    await Promise.all([api.get("/x"), api.get("/y")]);
    expect(refreshCount).toBe(1);
  });

  it("session cleared after sessionCleared action drops Authorization", async () => {
    const store = buildStore();
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);
    store.dispatch(sessionCleared());
    mock.onGet("/x").reply((conf) => {
      expect(conf.headers?.Authorization).toBeUndefined();
      return [200, { ok: true }];
    });
    await api.get("/x");
  });
});
