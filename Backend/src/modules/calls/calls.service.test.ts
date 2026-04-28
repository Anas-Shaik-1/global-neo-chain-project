import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { startTestDb, stopTestDb, clearTestDb } from "../../test/setup.js";

beforeAll(async () => {
  Object.assign(process.env, {
    PORT: "3000",
    MONGO_URI: "mongodb://localhost/test",
    FRONTEND_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: "x".repeat(32),
    JWT_REFRESH_SECRET: "y".repeat(32),
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
    SEED_ADMIN_EMAIL: "a@b.com",
    SEED_ADMIN_PASSWORD: "Password-1!",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
  await startTestDb();
  const { User } = await import("../../models/user.model.js");
  await User.init();
  const { CallSession } = await import("../../models/callSession.model.js");
  await CallSession.init();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function makeUser(email: string) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role: "EMPLOYEE",
  });
}

describe("calls.service", () => {
  it("initiateCall creates an INVITED session between caller and callee", async () => {
    const { initiateCall } = await import("./calls.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const out = await initiateCall(a._id.toString(), b._id.toString());
    expect(out.id).toBeTruthy();
    expect(out.status).toBe("INVITED");
    expect(out.caller.id).toBe(a._id.toString());
    expect(out.callee.id).toBe(b._id.toString());
    expect(out.acceptedAt).toBeNull();
    expect(out.endedAt).toBeNull();
    expect(out.endReason).toBeNull();
    expect(out.startedAt).toBeTruthy();
  });

  it("initiateCall rejects calling yourself", async () => {
    const { initiateCall } = await import("./calls.service.js");
    const a = await makeUser("a@b.com");
    await expect(
      initiateCall(a._id.toString(), a._id.toString()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("acceptCall transitions INVITED → ACTIVE for the callee", async () => {
    const { initiateCall, acceptCall } = await import("./calls.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const created = await initiateCall(a._id.toString(), b._id.toString());
    const out = await acceptCall(created.id, b._id.toString());
    expect(out.status).toBe("ACTIVE");
    expect(out.acceptedAt).toBeTruthy();
  });

  it("endCall by a non-participant throws ForbiddenError", async () => {
    const { initiateCall, endCall } = await import("./calls.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const c = await makeUser("c@b.com");
    const created = await initiateCall(a._id.toString(), b._id.toString());
    await expect(
      endCall(created.id, c._id.toString(), "HANGUP"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("endCall is idempotent on an already-ended call", async () => {
    const { initiateCall, acceptCall, endCall } = await import(
      "./calls.service.js"
    );
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const created = await initiateCall(a._id.toString(), b._id.toString());
    await acceptCall(created.id, b._id.toString());
    const first = await endCall(created.id, a._id.toString(), "HANGUP");
    expect(first.status).toBe("ENDED");
    expect(first.endReason).toBe("HANGUP");
    const firstEndedAt = first.endedAt!;
    const second = await endCall(created.id, a._id.toString(), "HANGUP");
    expect(second.status).toBe("ENDED");
    // No-op: endedAt unchanged.
    expect(second.endedAt).toEqual(firstEndedAt);
  });

  it("endCall with REJECT before accept moves status to REJECTED", async () => {
    const { initiateCall, endCall } = await import("./calls.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const created = await initiateCall(a._id.toString(), b._id.toString());
    const out = await endCall(created.id, b._id.toString(), "REJECT");
    expect(out.status).toBe("REJECTED");
    expect(out.endReason).toBe("REJECT");
  });

  it("listMyCalls returns calls where I'm caller or callee, newest first", async () => {
    const { initiateCall, listMyCalls } = await import("./calls.service.js");
    const a = await makeUser("a@b.com");
    const b = await makeUser("b@b.com");
    const c = await makeUser("c@b.com");
    await initiateCall(a._id.toString(), b._id.toString());
    await new Promise((r) => setTimeout(r, 5));
    await initiateCall(c._id.toString(), a._id.toString());
    const list = await listMyCalls(a._id.toString(), { limit: 10 });
    expect(list).toHaveLength(2);
    // newest first
    expect(list[0]!.caller.id).toBe(c._id.toString());
    expect(list[0]!.callee.id).toBe(a._id.toString());
  });
});
