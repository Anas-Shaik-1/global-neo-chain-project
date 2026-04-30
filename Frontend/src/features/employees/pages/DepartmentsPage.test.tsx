import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authSlice, sessionEstablished } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { DepartmentsPage } from "./DepartmentsPage";

function build() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  store.dispatch(sessionEstablished({
    accessToken: "t",
    user: { id: "admin1", email: "admin@b.com", name: "Admin", role: "ADMIN", isProjectManager: false, isVerified: true },
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

describe("DepartmentsPage", () => {
  it("admin can delete a department with 0 employees from the row action", async () => {
    const dept = {
      id: "d1",
      name: "Engineering",
      code: "eng",
      description: null,
      managerId: null,
      managerName: null,
      employeeCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mock.onGet("/departments").reply(200, { items: [dept], total: 1, page: 1, limit: 20 });
    let deleteCalled = false;
    mock.onDelete("/departments/d1").reply(() => {
      deleteCalled = true;
      return [204];
    });

    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <DepartmentsPage />
        </QueryClientProvider>
      </Provider>,
    );

    expect(await screen.findByText("Engineering")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete engineering/i }));
    // Confirmation dialog -> click the destructive Delete button (not the trigger)
    const confirmButtons = await screen.findAllByRole("button", { name: /^delete$/i });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(deleteCalled).toBe(true));
  });
});
