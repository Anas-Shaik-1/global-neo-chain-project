import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Types } from "mongoose";
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
  // Build indexes for User unique-email lookups
  const { User } = await import("../../models/user.model.js");
  await User.init();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

async function seedUser(role: "ADMIN" | "HR" | "EMPLOYEE" = "EMPLOYEE", overrides: Record<string, unknown> = {}) {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email: `u${Math.random()}@b.com`,
    passwordHash: await bcrypt.hash("pw", 4),
    name: "U",
    role,
    dateOfBirth: new Date("1990-01-01"),
    address: "secret",
    approvalStatus: "ACTIVE",
    ...overrides,
  });
}

describe("employees.service projection helpers", () => {
  it("toPublicProfile strips sensitive fields", async () => {
    const u = await seedUser();
    const { toPublicProfile } = await import("./employees.service.js");
    const p = toPublicProfile(u, null);
    expect((p as unknown as Record<string, unknown>).dateOfBirth).toBeUndefined();
    expect((p as unknown as Record<string, unknown>).address).toBeUndefined();
    expect(p.email).toBe(u.email);
    expect(p.role).toBe("EMPLOYEE");
  });

  it("toFullProfile includes sensitive fields", async () => {
    const u = await seedUser();
    const { toFullProfile } = await import("./employees.service.js");
    const f = toFullProfile(u, null);
    expect(f.dateOfBirth).toBeDefined();
    expect(f.address).toBe("secret");
  });

  it("canSeeFullProfile: HR yes, ADMIN yes, EMPLOYEE only on self", async () => {
    const { canSeeFullProfile } = await import("./employees.service.js");
    const me = new Types.ObjectId().toString();
    const other = new Types.ObjectId().toString();
    expect(canSeeFullProfile({ id: me, role: "HR" }, other)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "ADMIN" }, other)).toBe(true);
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, other)).toBe(false);
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, me)).toBe(true);
    // PM is no longer a primary role — its replacement is "EMPLOYEE with isProjectManager"
    // and that does NOT grant full-profile access (PMs see only public data of others).
    expect(canSeeFullProfile({ id: me, role: "EMPLOYEE" }, other)).toBe(false);
  });
});

describe("employees.service approval workflow", () => {
  it("listCandidates(hr) returns only PENDING_HR users", async () => {
    await seedUser("EMPLOYEE", { approvalStatus: "PENDING_HR" });
    await seedUser("EMPLOYEE", { approvalStatus: "PENDING_HR" });
    await seedUser("EMPLOYEE", { approvalStatus: "PENDING_ADMIN" });
    await seedUser("EMPLOYEE", { approvalStatus: "ACTIVE" });
    const { listCandidates } = await import("./employees.service.js");
    const out = await listCandidates({ stage: "hr" });
    expect(out.total).toBe(2);
    expect(out.items.every((u) => u.approvalStatus === "PENDING_HR")).toBe(true);
  });

  it("approveAtHrStage transitions PENDING_HR → PENDING_ADMIN and stamps hrApprovedAt", async () => {
    const candidate = await seedUser("EMPLOYEE", { approvalStatus: "PENDING_HR" });
    const hr = await seedUser("HR");
    const { approveAtHrStage } = await import("./employees.service.js");
    const out = await approveAtHrStage(candidate._id.toString(), hr._id.toString());
    expect(out.approvalStatus).toBe("PENDING_ADMIN");
    expect(out.hrApprovedAt).toBeInstanceOf(Date);
  });

  it("approveAtAdminStage transitions PENDING_ADMIN → ACTIVE and stamps adminApprovedAt", async () => {
    const candidate = await seedUser("EMPLOYEE", { approvalStatus: "PENDING_ADMIN" });
    const admin = await seedUser("ADMIN");
    const { approveAtAdminStage } = await import("./employees.service.js");
    const out = await approveAtAdminStage(candidate._id.toString(), admin._id.toString());
    expect(out.approvalStatus).toBe("ACTIVE");
    expect(out.adminApprovedAt).toBeInstanceOf(Date);
  });

  it("rejectCandidate sets approvalStatus=REJECTED with notes", async () => {
    const candidate = await seedUser("EMPLOYEE", { approvalStatus: "PENDING_HR" });
    const hr = await seedUser("HR");
    const { rejectCandidate } = await import("./employees.service.js");
    const out = await rejectCandidate(
      candidate._id.toString(),
      hr._id.toString(),
      "HR",
      "Not a fit",
    );
    expect(out.approvalStatus).toBe("REJECTED");
    expect(out.approvalNotes).toBe("Not a fit");
    expect(out.rejectedAt).toBeInstanceOf(Date);
  });

  it("approveAtHrStage on already-active user throws ConflictError", async () => {
    const active = await seedUser("EMPLOYEE", { approvalStatus: "ACTIVE" });
    const hr = await seedUser("HR");
    const { approveAtHrStage } = await import("./employees.service.js");
    await expect(
      approveAtHrStage(active._id.toString(), hr._id.toString()),
    ).rejects.toThrow();
  });
});

describe("employees.service positions", () => {
  it("addPosition with no prior open position just creates", async () => {
    const u = await seedUser();
    const { addPosition } = await import("./employees.service.js");
    const p = await addPosition(u._id.toString(), {
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-01-01"),
    });
    expect(p.endedAt).toBeNull();
  });

  it("addPosition auto-ends prior open position", async () => {
    const u = await seedUser();
    const { addPosition } = await import("./employees.service.js");
    const { Position } = await import("../../models/position.model.js");
    await addPosition(u._id.toString(), {
      title: "Old",
      employmentType: "FULL_TIME",
      startedAt: new Date("2023-01-01"),
    });
    await addPosition(u._id.toString(), {
      title: "New",
      employmentType: "FULL_TIME",
      startedAt: new Date("2024-06-01"),
    });
    const positions = await Position.find({ userId: u._id }).sort({ startedAt: 1 });
    expect(positions.length).toBe(2);
    expect(positions[0]!.endedAt).toBeInstanceOf(Date);
    expect(positions[1]!.endedAt).toBeNull();
  });
});

describe("employees.service deactivate", () => {
  it("deactivate sets isActive=false and ends open position", async () => {
    const u = await seedUser();
    const { addPosition, deactivate } = await import("./employees.service.js");
    const { Position } = await import("../../models/position.model.js");
    const { User } = await import("../../models/user.model.js");
    await addPosition(u._id.toString(), {
      title: "Eng",
      employmentType: "FULL_TIME",
      startedAt: new Date("2023-01-01"),
    });
    await deactivate(u._id.toString());
    const fresh = await User.findById(u._id);
    expect(fresh?.isActive).toBe(false);
    const open = await Position.find({ userId: u._id, endedAt: null });
    expect(open.length).toBe(0);
  });
});
