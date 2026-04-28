import { describe, it, expect } from "vitest";
import { authSlice, sessionEstablished, sessionCleared, accessTokenRefreshed, type AuthState, type AuthUser } from "./authSlice";

const sampleUser: AuthUser = {
  id: "u1",
  email: "a@b.com",
  name: "A",
  role: "ADMIN",
  isVerified: true,
};

describe("authSlice", () => {
  const init = (): AuthState => authSlice.getInitialState();

  it("initial state is unauthenticated", () => {
    expect(init()).toEqual({ accessToken: null, user: null });
  });

  it("sessionEstablished sets token + user", () => {
    const next = authSlice.reducer(init(), sessionEstablished({ accessToken: "tk", user: sampleUser }));
    expect(next.accessToken).toBe("tk");
    expect(next.user).toEqual(sampleUser);
  });

  it("accessTokenRefreshed updates only token", () => {
    const seeded: AuthState = { accessToken: "old", user: sampleUser };
    const next = authSlice.reducer(seeded, accessTokenRefreshed("new"));
    expect(next.accessToken).toBe("new");
    expect(next.user).toEqual(sampleUser);
  });

  it("sessionCleared resets both", () => {
    const seeded: AuthState = { accessToken: "tk", user: sampleUser };
    const next = authSlice.reducer(seeded, sessionCleared());
    expect(next).toEqual({ accessToken: null, user: null });
  });
});
