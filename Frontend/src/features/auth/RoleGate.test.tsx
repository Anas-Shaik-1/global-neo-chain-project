import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice, sessionEstablished } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { RoleGate } from "./RoleGate";

function buildStore() {
  return configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
}

const sampleUser = (
  role: "ADMIN" | "HR" | "EMPLOYEE",
  isProjectManager = false,
) => ({
  id: "u1",
  email: "a@b.com",
  name: "A",
  role,
  isProjectManager,
  isVerified: true,
});

describe("RoleGate", () => {
  it("renders children when user role is allowed", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("HR") }));
    render(
      <Provider store={store}>
        <RoleGate roles={["HR", "ADMIN"]}><span>visible</span></RoleGate>
      </Provider>,
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("renders nothing when user role is not allowed", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("EMPLOYEE") }));
    render(
      <Provider store={store}>
        <RoleGate roles={["HR", "ADMIN"]}><span>secret</span></RoleGate>
      </Provider>,
    );
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders fallback when provided and role not allowed", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("EMPLOYEE") }));
    render(
      <Provider store={store}>
        <RoleGate roles={["HR"]} fallback={<span>nope</span>}><span>secret</span></RoleGate>
      </Provider>,
    );
    expect(screen.getByText("nope")).toBeInTheDocument();
  });

  it("requirePM renders children for an EMPLOYEE with isProjectManager=true", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("EMPLOYEE", true) }));
    render(
      <Provider store={store}>
        <RoleGate requirePM><span>pm-only</span></RoleGate>
      </Provider>,
    );
    expect(screen.getByText("pm-only")).toBeInTheDocument();
  });

  it("requirePM renders fallback for an EMPLOYEE with isProjectManager=false", () => {
    const store = buildStore();
    store.dispatch(sessionEstablished({ accessToken: "t", user: sampleUser("EMPLOYEE", false) }));
    render(
      <Provider store={store}>
        <RoleGate requirePM fallback={<span>denied</span>}><span>pm-only</span></RoleGate>
      </Provider>,
    );
    expect(screen.getByText("denied")).toBeInTheDocument();
  });
});
