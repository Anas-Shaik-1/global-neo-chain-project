import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authSlice, sessionEstablished } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { PeopleListPage } from "./PeopleListPage";

function build() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  store.dispatch(sessionEstablished({
    accessToken: "t",
    user: { id: "u1", email: "u@b.com", name: "U", role: "HR", isProjectManager: false, isVerified: true },
  }));
  setupApiClient(store, "http://api");
  return { store, qc: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
}

let store: ReturnType<typeof build>["store"];
let qc: ReturnType<typeof build>["qc"];
let mock: MockAdapter;

beforeEach(() => {
  ({ store, qc } = build());
  mock = new MockAdapter(getApi());
});

describe("PeopleListPage", () => {
  it("renders rows from list endpoint", async () => {
    mock.onGet("/employees").reply(200, {
      items: [
        { id: "1", email: "a@b.com", name: "Alice", role: "EMPLOYEE", isActive: true, jobTitle: "Eng", departmentName: "Eng" },
        { id: "2", email: "b@b.com", name: "Bob", role: "EMPLOYEE", isActive: true, jobTitle: "PM", departmentName: "Product" },
      ],
      total: 2, page: 1, limit: 50,
    });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter><PeopleListPage /></MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("HR sees the Review candidates button", async () => {
    mock.onGet("/employees").reply(200, { items: [], total: 0, page: 1, limit: 50 });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <MemoryRouter><PeopleListPage /></MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );
    expect(await screen.findByRole("link", { name: /review candidates/i })).toBeInTheDocument();
  });
});
