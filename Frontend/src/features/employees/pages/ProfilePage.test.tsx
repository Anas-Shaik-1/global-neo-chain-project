import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authSlice, sessionEstablished } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { presenceSlice } from "@/features/chat/presenceSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { ProfilePage } from "./ProfilePage";

function build() {
  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      ui: uiSlice.reducer,
      presence: presenceSlice.reducer,
    },
  });
  store.dispatch(sessionEstablished({
    accessToken: "t",
    user: { id: "u1", email: "u@b.com", name: "User", role: "EMPLOYEE", isProjectManager: false, isVerified: true },
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

// Phone is stored backend-side as `+91XXXXXXXXXX`; the ProfilePage strips
// the country-code prefix and displays just the 10-digit subscriber portion
// in the edit input.
const fullProfile = {
  id: "u1", email: "u@b.com", name: "User", role: "EMPLOYEE", isActive: true,
  jobTitle: "Engineer", phone: "+919876543210", bio: "hello",
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe("ProfilePage", () => {
  it("renders own profile fields", async () => {
    mock.onGet("/employees/u1").reply(200, fullProfile);
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <ProfilePage />
        </QueryClientProvider>
      </Provider>,
    );
    expect(await screen.findByDisplayValue("User")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("PATCH on save", async () => {
    mock.onGet("/employees/u1").reply(200, fullProfile);
    let body: Record<string, unknown> | null = null;
    mock.onPatch("/employees/u1").reply((conf) => {
      body = JSON.parse(conf.data as string);
      return [200, { ...fullProfile, bio: "new bio" }];
    });
    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <ProfilePage />
        </QueryClientProvider>
      </Provider>,
    );
    const bio = await screen.findByLabelText(/bio/i);
    await userEvent.clear(bio);
    await userEvent.type(bio, "new bio");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.bio).toBe("new bio");
  });
});
