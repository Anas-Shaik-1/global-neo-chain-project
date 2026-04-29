import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { authSlice, sessionEstablished } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { ProtectedRoute } from "./ProtectedRoute";

function buildStore() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  setupApiClient(store, "http://api");
  return store;
}

let store: ReturnType<typeof buildStore>;
let mock: MockAdapter;

beforeEach(() => {
  store = buildStore();
  mock = new MockAdapter(getApi());
});

describe("ProtectedRoute", () => {
  it("redirects to /login when refresh fails", async () => {
    mock.onPost("/auth/refresh").reply(401);
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>private</div>} />
            </Route>
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });

  it("renders the outlet when already authenticated", async () => {
    store.dispatch(
      sessionEstablished({
        accessToken: "tk",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isProjectManager: false, isVerified: true },
      }),
    );
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>private</div>} />
            </Route>
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("renders 403 when authenticated but role not allowed", async () => {
    store.dispatch(
      sessionEstablished({
        accessToken: "tk",
        user: { id: "u1", email: "a@b.com", name: "A", role: "EMPLOYEE", isProjectManager: false, isVerified: true },
      }),
    );
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
              <Route path="/admin" element={<div>admin</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/403/i)).toBeInTheDocument();
  });
});
