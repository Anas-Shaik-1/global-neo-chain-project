import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { authSlice } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { presenceSlice } from "@/features/chat/presenceSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { LoginPage } from "./LoginPage";

function buildStore() {
  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      ui: uiSlice.reducer,
      presence: presenceSlice.reducer,
    },
  });
  setupApiClient(store, "http://api");
  return store;
}

let store: ReturnType<typeof buildStore>;
let mock: MockAdapter;

beforeEach(() => {
  store = buildStore();
  mock = new MockAdapter(getApi());
});

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe("LoginPage", () => {
  it("renders email/password fields", () => {
    renderPage();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("on submit redirects to /dashboard on success", async () => {
    mock.onPost("/auth/login").reply(200, {
      accessToken: "tk",
      user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isProjectManager: false, isVerified: true },
    });
    renderPage();
    await userEvent.type(screen.getByLabelText(/work email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("shows server error message on 401", async () => {
    mock.onPost("/auth/login").reply(401, { code: "UNAUTHORIZED", message: "Invalid credentials" });
    renderPage();
    await userEvent.type(screen.getByLabelText(/work email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });
});
