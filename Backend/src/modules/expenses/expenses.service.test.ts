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
  const { Expense } = await import("../../models/expense.model.js");
  await Expense.init();
});
afterAll(async () => {
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

async function makeUser(email: string, role: "EMPLOYEE" | "HR" | "ADMIN" = "EMPLOYEE") {
  const { User } = await import("../../models/user.model.js");
  return User.create({
    email,
    passwordHash: await bcrypt.hash("pw", 4),
    name: email,
    role,
  });
}

describe("expenses.service", () => {
  it("createExpense returns denormalized expense with PENDING status", async () => {
    const { createExpense } = await import("./expenses.service.js");
    const u = await makeUser("alice@b.com");
    const out = await createExpense(u._id.toString(), {
      amount: 1500,
      category: "MEALS",
      description: "Team lunch",
      incurredOn: new Date("2026-04-20"),
    });
    expect(out.status).toBe("PENDING");
    expect(out.amount).toBe(1500);
    expect(out.currency).toBe("USD");
    expect(out.userId).toBe(u._id.toString());
    expect(out.userName).toBe("alice@b.com");
    expect(out.decisionById).toBeNull();
    expect(out.decidedAt).toBeNull();
  });

  it("decideExpense pending->approved sets status, decisionById and decidedAt", async () => {
    const { createExpense, decideExpense } = await import("./expenses.service.js");
    const employee = await makeUser("e@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    const created = await createExpense(employee._id.toString(), {
      amount: 200,
      category: "TRAVEL",
      description: "Cab fare",
      incurredOn: new Date("2026-04-20"),
    });
    const decided = await decideExpense(
      created.id,
      hr._id.toString(),
      "APPROVED",
      "ok",
    );
    expect(decided.status).toBe("APPROVED");
    expect(decided.decisionById).toBe(hr._id.toString());
    expect(decided.decisionByName).toBe("hr@b.com");
    expect(decided.decisionNote).toBe("ok");
    expect(decided.decidedAt).toBeTruthy();
  });

  it("decideExpense on already-decided expense throws ConflictError 409", async () => {
    const { createExpense, decideExpense } = await import("./expenses.service.js");
    const employee = await makeUser("e@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    const created = await createExpense(employee._id.toString(), {
      amount: 200,
      category: "TRAVEL",
      description: "Cab fare",
      incurredOn: new Date("2026-04-20"),
    });
    await decideExpense(created.id, hr._id.toString(), "APPROVED");
    await expect(
      decideExpense(created.id, hr._id.toString(), "REJECTED"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("getExpense by other employee throws ForbiddenError 403", async () => {
    const { createExpense, getExpense } = await import("./expenses.service.js");
    const owner = await makeUser("owner@b.com");
    const other = await makeUser("other@b.com");
    const created = await createExpense(owner._id.toString(), {
      amount: 200,
      category: "OFFICE",
      description: "Pens",
      incurredOn: new Date("2026-04-20"),
    });
    await expect(
      getExpense(created.id, { id: other._id.toString(), role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("getExpense by HR succeeds", async () => {
    const { createExpense, getExpense } = await import("./expenses.service.js");
    const owner = await makeUser("owner@b.com");
    const hr = await makeUser("hr@b.com", "HR");
    const created = await createExpense(owner._id.toString(), {
      amount: 999,
      category: "SOFTWARE",
      description: "Editor license",
      incurredOn: new Date("2026-04-21"),
    });
    const got = await getExpense(created.id, {
      id: hr._id.toString(),
      role: "HR",
    });
    expect(got.id).toBe(created.id);
    expect(got.userName).toBe("owner@b.com");
  });
});
